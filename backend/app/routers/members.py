from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    FeeItem,
    Member,
    MemberStatus,
    Package,
    Payment,
    PaymentKind,
    Renewal,
    Trainer,
    TrainerPackage,
    User,
    add_months,
    compute_payment_status,
)
from app.schemas import MemberCreate, MemberOut, MemberRenewRequest, MemberUpdate, Message

router = APIRouter(
    prefix="/api/members",
    tags=["members"],
    dependencies=[Depends(get_current_user)],
)


def member_query(db: Session):
    return db.query(Member).options(
        joinedload(Member.package),
        joinedload(Member.trainer_package),
        joinedload(Member.trainer),
    )


def get_member_or_404(db: Session, member_id: int) -> Member:
    member = member_query(db).filter(Member.id == member_id).first()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return member


def ensure_cnic_available(db: Session, cnic: str, exclude_id: int | None = None) -> None:
    query = db.query(Member).filter(Member.cnic == cnic)
    if exclude_id is not None:
        query = query.filter(Member.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A member with CNIC '{cnic}' already exists",
        )


def get_active_package_or_400(db: Session, package_id: int) -> Package:
    package = db.get(Package, package_id)
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    if not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected package is inactive",
        )
    return package


def get_active_trainer_package_or_400(db: Session, package_id: int) -> TrainerPackage:
    package = db.get(TrainerPackage, package_id)
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer package not found")
    if not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected trainer package is inactive",
        )
    return package


def get_active_trainer_or_400(db: Session, trainer_id: int) -> Trainer:
    trainer = db.get(Trainer, trainer_id)
    if trainer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")
    if not trainer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected trainer is inactive",
        )
    return trainer


def resolve_addon_fees(
    db: Session, fee_ids: list[int], duration_months: int
) -> tuple[Decimal, list[str]]:
    """Sum selected fee-table add-ons. Per-month fees multiply by package duration."""
    if not fee_ids:
        return Decimal("0.00"), []

    unique_ids = list(dict.fromkeys(fee_ids))
    fees = db.query(FeeItem).filter(FeeItem.id.in_(unique_ids)).all()
    by_id = {fee.id: fee for fee in fees}
    total = Decimal("0.00")
    names: list[str] = []

    for fee_id in unique_ids:
        fee = by_id.get(fee_id)
        if fee is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fee item {fee_id} not found",
            )
        if not fee.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fee item '{fee.name}' is inactive",
            )
        unit = (fee.unit or "").strip().lower()
        line = Decimal(fee.price)
        if unit == "per month":
            line *= duration_months
        total += line
        names.append(fee.name)

    return total, names


def sync_member_status(member: Member, today: date | None = None) -> None:
    """Mark active members as expired when past end_date."""
    today = today or date.today()
    if member.status == MemberStatus.ACTIVE.value and member.end_date < today:
        member.status = MemberStatus.EXPIRED.value


@router.get("", response_model=list[MemberOut])
def list_members(
    q: str | None = Query(default=None, description="Search name, contact, or CNIC"),
    status_filter: str | None = Query(default=None, alias="status"),
    payment_status: str | None = None,
    db: Session = Depends(get_db),
):
    query = member_query(db)

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Member.full_name.ilike(term),
                Member.contact.ilike(term),
                Member.cnic.ilike(term),
            )
        )

    if status_filter:
        query = query.filter(Member.status == status_filter)

    if payment_status:
        query = query.filter(Member.payment_status == payment_status)

    members = query.order_by(Member.created_at.desc()).all()

    changed = False
    for member in members:
        before = member.status
        sync_member_status(member)
        if member.status != before:
            changed = True
    if changed:
        db.commit()
        for member in members:
            db.refresh(member)

    return members


@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_cnic_available(db, payload.cnic)
    package = get_active_package_or_400(db, payload.package_id)

    start = payload.start_date or date.today()
    end = add_months(start, package.duration_months)
    addon_total, addon_names = resolve_addon_fees(db, payload.addon_fee_ids, package.duration_months)
    amount_due = Decimal(package.price) + addon_total
    amount_paid = Decimal(payload.amount_paid)
    payment_status = compute_payment_status(amount_paid, amount_due)

    member_status = MemberStatus.ACTIVE.value
    if end < date.today():
        member_status = MemberStatus.EXPIRED.value

    trainer_fields: dict = {
        "trainer_package_id": None,
        "trainer_id": None,
        "trainer_start_date": None,
        "trainer_end_date": None,
        "trainer_amount_due": None,
        "trainer_amount_paid": None,
        "trainer_payment_status": None,
    }

    if payload.trainer_package_id is not None:
        trainer_pkg = get_active_trainer_package_or_400(db, payload.trainer_package_id)
        trainer_paid = Decimal(payload.trainer_amount_paid)
        trainer_due = Decimal(trainer_pkg.price)
        trainer_fields = {
            "trainer_package_id": trainer_pkg.id,
            "trainer_id": None,
            "trainer_start_date": start,
            "trainer_end_date": add_months(start, trainer_pkg.duration_months),
            "trainer_amount_due": trainer_due,
            "trainer_amount_paid": trainer_paid,
            "trainer_payment_status": compute_payment_status(trainer_paid, trainer_due),
        }
        if payload.trainer_id is not None:
            trainer = get_active_trainer_or_400(db, payload.trainer_id)
            trainer_fields["trainer_id"] = trainer.id
    elif payload.trainer_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assign a trainer package before selecting a trainer",
        )

    member = Member(
        full_name=payload.full_name,
        contact=payload.contact,
        cnic=payload.cnic,
        email=payload.email,
        address=payload.address,
        package_id=package.id,
        start_date=start,
        end_date=end,
        amount_due=amount_due,
        amount_paid=amount_paid,
        payment_status=payment_status,
        status=member_status,
        **trainer_fields,
    )
    db.add(member)
    db.flush()

    now = datetime.utcnow()
    if amount_paid > 0:
        note = "Initial gym payment on admission"
        if addon_names:
            note = f"{note} — {', '.join(addon_names)}"
        db.add(
            Payment(
                member_id=member.id,
                kind=PaymentKind.GYM.value,
                amount=amount_paid,
                note=note,
                paid_at=now,
                recorded_by=current_user.username,
            )
        )

    trainer_paid_amount = Decimal(trainer_fields.get("trainer_amount_paid") or 0)
    if trainer_fields.get("trainer_package_id") and trainer_paid_amount > 0:
        db.add(
            Payment(
                member_id=member.id,
                kind=PaymentKind.TRAINER.value,
                amount=trainer_paid_amount,
                note="Initial trainer payment on admission",
                paid_at=now,
                recorded_by=current_user.username,
            )
        )

    db.commit()
    return get_member_or_404(db, member.id)


@router.get("/{member_id}", response_model=MemberOut)
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = get_member_or_404(db, member_id)
    before = member.status
    sync_member_status(member)
    if member.status != before:
        db.commit()
        db.refresh(member)
    return member


@router.put("/{member_id}", response_model=MemberOut)
def update_member(member_id: int, payload: MemberUpdate, db: Session = Depends(get_db)):
    member = get_member_or_404(db, member_id)
    changes = payload.model_dump(exclude_unset=True)

    if "cnic" in changes:
        ensure_cnic_available(db, changes["cnic"], exclude_id=member_id)

    if "trainer_id" in changes and changes["trainer_id"] is not None:
        if member.trainer_package_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Member has no trainer package assigned",
            )
        get_active_trainer_or_400(db, changes["trainer_id"])

    for field, value in changes.items():
        setattr(member, field, value)

    sync_member_status(member)
    db.commit()
    return get_member_or_404(db, member.id)


@router.delete("/{member_id}", response_model=Message)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = get_member_or_404(db, member_id)
    name = member.full_name
    db.delete(member)
    db.commit()
    return Message(message=f"Member '{name}' deleted")


@router.post("/{member_id}/renew", response_model=MemberOut)
def renew_member(
    member_id: int,
    payload: MemberRenewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = get_member_or_404(db, member_id)
    if member.status == MemberStatus.INACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive members cannot be renewed",
        )

    package = get_active_package_or_400(db, payload.package_id)
    today = date.today()
    start = payload.start_date or today
    end = add_months(start, package.duration_months)
    addon_total, addon_names = resolve_addon_fees(db, payload.addon_fee_ids, package.duration_months)
    amount_due = Decimal(package.price) + addon_total
    amount_paid = Decimal(payload.amount_paid)
    payment_status = compute_payment_status(amount_paid, amount_due)

    renewal = Renewal(
        member_id=member.id,
        package_id=package.id,
        start_date=start,
        end_date=end,
        amount_due=amount_due,
        amount_paid=amount_paid,
        payment_status=payment_status,
        recorded_by=current_user.username,
    )
    db.add(renewal)

    member.package_id = package.id
    member.start_date = start
    member.end_date = end
    member.amount_due = amount_due
    member.amount_paid = amount_paid
    member.payment_status = payment_status
    member.status = MemberStatus.ACTIVE.value if end >= today else MemberStatus.EXPIRED.value

    now = datetime.utcnow()
    if amount_paid > 0:
        note = f"Renewal payment — {package.name}"
        if addon_names:
            note = f"{note} — {', '.join(addon_names)}"
        db.add(
            Payment(
                member_id=member.id,
                kind=PaymentKind.GYM.value,
                amount=amount_paid,
                note=note,
                paid_at=now,
                recorded_by=current_user.username,
            )
        )

    if payload.clear_trainer:
        member.trainer_package_id = None
        member.trainer_id = None
        member.trainer_start_date = None
        member.trainer_end_date = None
        member.trainer_amount_due = None
        member.trainer_amount_paid = None
        member.trainer_payment_status = None
    elif payload.trainer_package_id is not None:
        trainer_pkg = get_active_trainer_package_or_400(db, payload.trainer_package_id)
        trainer_due = Decimal(trainer_pkg.price)
        trainer_paid = Decimal(payload.trainer_amount_paid)
        member.trainer_package_id = trainer_pkg.id
        member.trainer_start_date = start
        member.trainer_end_date = add_months(start, trainer_pkg.duration_months)
        member.trainer_amount_due = trainer_due
        member.trainer_amount_paid = trainer_paid
        member.trainer_payment_status = compute_payment_status(trainer_paid, trainer_due)
        if payload.trainer_id is not None:
            member.trainer_id = get_active_trainer_or_400(db, payload.trainer_id).id
        if trainer_paid > 0:
            db.add(
                Payment(
                    member_id=member.id,
                    kind=PaymentKind.TRAINER.value,
                    amount=trainer_paid,
                    note=f"Trainer renewal — {trainer_pkg.name}",
                    paid_at=now,
                    recorded_by=current_user.username,
                )
            )
    elif payload.trainer_id is not None:
        if member.trainer_package_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assign a trainer package when selecting a trainer",
            )
        member.trainer_id = get_active_trainer_or_400(db, payload.trainer_id).id

    db.commit()
    return get_member_or_404(db, member.id)
