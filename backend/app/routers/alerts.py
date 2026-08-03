from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import Member, MemberStatus
from app.schemas import AlertItem, AlertsResponse, Message

router = APIRouter(
    prefix="/api/alerts",
    tags=["alerts"],
    dependencies=[Depends(get_current_user)],
)

DEFAULT_DAYS = 7


def sync_expired_members(db: Session, today: date | None = None) -> int:
    """Mark active members past gym end_date as expired. Returns count updated."""
    today = today or date.today()
    members = (
        db.query(Member)
        .filter(Member.status == MemberStatus.ACTIVE.value, Member.end_date < today)
        .all()
    )
    for member in members:
        member.status = MemberStatus.EXPIRED.value
    if members:
        db.commit()
    return len(members)


def build_alert(
    member: Member,
    *,
    alert_type: str,
    scope: str,
    package_name: str,
    end_date: date,
    days_left: int,
    payment_status: str | None,
) -> AlertItem:
    return AlertItem(
        member_id=member.id,
        member_name=member.full_name,
        contact=member.contact,
        alert_type=alert_type,
        scope=scope,
        package_name=package_name,
        end_date=end_date,
        days_left=days_left,
        payment_status=payment_status,
        status=member.status,
    )


def collect_alerts(db: Session, days: int = DEFAULT_DAYS) -> tuple[list[AlertItem], list[AlertItem]]:
    today = date.today()
    soon_limit = today + timedelta(days=days)

    members = (
        db.query(Member)
        .options(
            joinedload(Member.package),
            joinedload(Member.trainer_package),
        )
        .filter(Member.status != MemberStatus.INACTIVE.value)
        .all()
    )

    expired: list[AlertItem] = []
    expiring_soon: list[AlertItem] = []

    for member in members:
        # Gym membership alerts
        gym_days = (member.end_date - today).days
        package_name = member.package.name if member.package else "Gym package"
        if member.end_date < today:
            expired.append(
                build_alert(
                    member,
                    alert_type="expired",
                    scope="gym",
                    package_name=package_name,
                    end_date=member.end_date,
                    days_left=gym_days,
                    payment_status=member.payment_status,
                )
            )
        elif today <= member.end_date <= soon_limit:
            expiring_soon.append(
                build_alert(
                    member,
                    alert_type="expiring_soon",
                    scope="gym",
                    package_name=package_name,
                    end_date=member.end_date,
                    days_left=gym_days,
                    payment_status=member.payment_status,
                )
            )

        # Trainer package alerts (if assigned)
        if member.trainer_package_id and member.trainer_end_date and member.trainer_package:
            trainer_days = (member.trainer_end_date - today).days
            trainer_name = member.trainer_package.name
            if member.trainer_end_date < today:
                expired.append(
                    build_alert(
                        member,
                        alert_type="trainer_expired",
                        scope="trainer",
                        package_name=trainer_name,
                        end_date=member.trainer_end_date,
                        days_left=trainer_days,
                        payment_status=member.trainer_payment_status,
                    )
                )
            elif today <= member.trainer_end_date <= soon_limit:
                expiring_soon.append(
                    build_alert(
                        member,
                        alert_type="trainer_expiring_soon",
                        scope="trainer",
                        package_name=trainer_name,
                        end_date=member.trainer_end_date,
                        days_left=trainer_days,
                        payment_status=member.trainer_payment_status,
                    )
                )

    expired.sort(key=lambda a: a.end_date)
    expiring_soon.sort(key=lambda a: a.end_date)
    return expired, expiring_soon


@router.get("", response_model=AlertsResponse)
def list_alerts(days: int = Query(default=DEFAULT_DAYS, ge=1, le=60), db: Session = Depends(get_db)):
    synced = sync_expired_members(db)
    expired, expiring_soon = collect_alerts(db, days=days)
    return AlertsResponse(
        expired=expired,
        expiring_soon=expiring_soon,
        total=len(expired) + len(expiring_soon),
        synced=synced,
    )


@router.post("/sync", response_model=Message)
def sync_alerts(db: Session = Depends(get_db)):
    count = sync_expired_members(db)
    return Message(message=f"Marked {count} member(s) as expired")
