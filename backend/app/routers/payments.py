from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Member,
    Payment,
    PaymentKind,
    User,
    apply_payment_to_member,
    reverse_payment_from_member,
)
from app.routers.members import get_member_or_404
from app.schemas import Message, PaymentCreate, PaymentOut, PaymentWithMember

router = APIRouter(tags=["payments"], dependencies=[Depends(get_current_user)])


def serialize_payment(payment: Payment, member_name: str | None = None) -> PaymentOut:
    return PaymentOut(
        id=payment.id,
        member_id=payment.member_id,
        kind=payment.kind,
        amount=payment.amount,
        note=payment.note,
        paid_at=payment.paid_at,
        recorded_by=payment.recorded_by,
        member_name=member_name,
    )


@router.get("/api/members/{member_id}/payments", response_model=list[PaymentOut])
def list_member_payments(member_id: int, db: Session = Depends(get_db)):
    member = get_member_or_404(db, member_id)
    payments = (
        db.query(Payment)
        .filter(Payment.member_id == member.id)
        .order_by(Payment.paid_at.desc(), Payment.id.desc())
        .all()
    )
    return [serialize_payment(p, member.full_name) for p in payments]


@router.post(
    "/api/members/{member_id}/payments",
    response_model=PaymentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_member_payment(
    member_id: int,
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = get_member_or_404(db, member_id)
    amount = Decimal(payload.amount)

    if payload.kind == PaymentKind.TRAINER.value and member.trainer_package_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member has no trainer package to pay against",
        )

    try:
        apply_payment_to_member(member, payload.kind, amount)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    payment = Payment(
        member_id=member.id,
        kind=payload.kind,
        amount=amount,
        note=payload.note,
        paid_at=payload.paid_at or datetime.utcnow(),
        recorded_by=current_user.username,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return serialize_payment(payment, member.full_name)


@router.get("/api/payments", response_model=list[PaymentWithMember])
def list_recent_payments(
    limit: int = Query(default=50, ge=1, le=200),
    kind: str | None = Query(default=None, pattern="^(gym|trainer)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Payment).options(joinedload(Payment.member))
    if kind:
        query = query.filter(Payment.kind == kind)
    payments = query.order_by(Payment.paid_at.desc(), Payment.id.desc()).limit(limit).all()

    return [
        PaymentWithMember(
            id=p.id,
            member_id=p.member_id,
            kind=p.kind,
            amount=p.amount,
            note=p.note,
            paid_at=p.paid_at,
            recorded_by=p.recorded_by,
            member_name=p.member.full_name if p.member else "Unknown",
            member_payment_status=p.member.payment_status if p.member else None,
            member_trainer_payment_status=p.member.trainer_payment_status if p.member else None,
        )
        for p in payments
    ]


@router.delete("/api/payments/{payment_id}", response_model=Message)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    member = db.get(Member, payment.member_id)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    reverse_payment_from_member(member, payment.kind, Decimal(payment.amount))
    db.delete(payment)
    db.commit()
    return Message(message="Payment deleted")
