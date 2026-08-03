from __future__ import annotations

import calendar
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PaymentStatus(str, Enum):
    PAID = "paid"
    UNPAID = "unpaid"
    PARTIAL = "partial"


class MemberStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    INACTIVE = "inactive"


class TrainerPackageCategory(str, Enum):
    TRAINING_GUIDANCE = "training_guidance"
    GROUP_TRAINING = "group_training"
    PERSONAL_TRAINING = "personal_training"


CATEGORY_LABELS = {
    TrainerPackageCategory.TRAINING_GUIDANCE.value: "Training Guidance",
    TrainerPackageCategory.GROUP_TRAINING.value: "Group Training",
    TrainerPackageCategory.PERSONAL_TRAINING.value: "Personal Training",
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="admin", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    duration_months: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    members: Mapped[list[Member]] = relationship(back_populates="package")


class FeeItem(Base):
    """Gym fee table / rate card."""

    __tablename__ = "fee_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(40), default="fixed", nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Trainer(Base):
    __tablename__ = "trainers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    contact: Mapped[str] = mapped_column(String(30), nullable=False)
    specialty: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    members: Mapped[list[Member]] = relationship(back_populates="trainer")


class TrainerPackage(Base):
    __tablename__ = "trainer_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    duration_months: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    members: Mapped[list[Member]] = relationship(back_populates="trainer_package")


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    contact: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    cnic: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)

    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    payment_status: Mapped[str] = mapped_column(String(20), default=PaymentStatus.UNPAID.value, nullable=False)
    amount_due: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)

    trainer_package_id: Mapped[int | None] = mapped_column(ForeignKey("trainer_packages.id"), nullable=True)
    trainer_id: Mapped[int | None] = mapped_column(ForeignKey("trainers.id"), nullable=True)
    trainer_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    trainer_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    trainer_amount_due: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    trainer_amount_paid: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    trainer_payment_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default=MemberStatus.ACTIVE.value, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    package: Mapped[Package] = relationship(back_populates="members")
    trainer_package: Mapped[TrainerPackage | None] = relationship(back_populates="members")
    trainer: Mapped[Trainer | None] = relationship(back_populates="members")
    payments: Mapped[list[Payment]] = relationship(back_populates="member", cascade="all, delete-orphan")
    renewals: Mapped[list[Renewal]] = relationship(back_populates="member", cascade="all, delete-orphan")


class PaymentKind(str, Enum):
    GYM = "gym"
    TRAINER = "trainer"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), default=PaymentKind.GYM.value, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    recorded_by: Mapped[str] = mapped_column(String(50), nullable=False)

    member: Mapped[Member] = relationship(back_populates="payments")


class Renewal(Base):
    """History of gym membership renewals / plan changes."""

    __tablename__ = "renewals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), nullable=False, index=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_due: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False)
    recorded_by: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    member: Mapped[Member] = relationship(back_populates="renewals")
    package: Mapped[Package] = relationship()


def add_months(start: date, months: int) -> date:
    """Add calendar months to a date, clamping the day when needed."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def compute_payment_status(amount_paid: Decimal, amount_due: Decimal) -> str:
    if amount_paid <= 0:
        return PaymentStatus.UNPAID.value
    if amount_paid < amount_due:
        return PaymentStatus.PARTIAL.value
    return PaymentStatus.PAID.value


def apply_payment_to_member(member: Member, kind: str, amount: Decimal) -> None:
    """Increase paid amount and refresh payment status for gym or trainer balance."""
    if kind == PaymentKind.TRAINER.value:
        if member.trainer_package_id is None or member.trainer_amount_due is None:
            raise ValueError("Member has no trainer package balance")
        paid = Decimal(member.trainer_amount_paid or 0) + amount
        member.trainer_amount_paid = paid
        member.trainer_payment_status = compute_payment_status(paid, Decimal(member.trainer_amount_due))
        return

    paid = Decimal(member.amount_paid) + amount
    member.amount_paid = paid
    member.payment_status = compute_payment_status(paid, Decimal(member.amount_due))


def reverse_payment_from_member(member: Member, kind: str, amount: Decimal) -> None:
    """Subtract a recorded payment and refresh payment status (paid never below zero)."""
    if kind == PaymentKind.TRAINER.value:
        due = Decimal(member.trainer_amount_due or 0)
        paid = max(Decimal("0.00"), Decimal(member.trainer_amount_paid or 0) - amount)
        member.trainer_amount_paid = paid
        if member.trainer_package_id is not None:
            member.trainer_payment_status = compute_payment_status(paid, due)
        return

    paid = max(Decimal("0.00"), Decimal(member.amount_paid) - amount)
    member.amount_paid = paid
    member.payment_status = compute_payment_status(paid, Decimal(member.amount_due))
