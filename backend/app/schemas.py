from datetime import date, datetime
from decimal import Decimal
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class HealthResponse(BaseModel):
    status: str
    app: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Message(BaseModel):
    message: str


class TokenData(BaseModel):
    username: Optional[str] = None


class PackageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    duration_months: int = Field(ge=1, le=120)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name cannot be empty")
        return cleaned


class PackageUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    duration_months: Optional[int] = Field(default=None, ge=1, le=120)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name cannot be empty")
        return cleaned


class PackageOut(BaseModel):
    id: int
    name: str
    duration_months: int
    price: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PackageBrief(BaseModel):
    id: int
    name: str
    duration_months: int
    price: Decimal

    model_config = {"from_attributes": True}


class FeeItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    unit: str = Field(default="fixed", max_length=40)
    notes: Optional[str] = Field(default=None, max_length=255)
    sort_order: int = 0
    is_active: bool = True

    @field_validator("name", "unit")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty")
        return cleaned


class FeeItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    unit: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=255)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class FeeItemOut(BaseModel):
    id: int
    name: str
    price: Decimal
    unit: str
    notes: Optional[str]
    sort_order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TrainerCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    contact: str = Field(min_length=1, max_length=30)
    specialty: Optional[str] = Field(default=None, max_length=120)
    is_active: bool = True

    @field_validator("full_name", "contact")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty")
        return cleaned


class TrainerUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    contact: Optional[str] = Field(default=None, min_length=1, max_length=30)
    specialty: Optional[str] = Field(default=None, max_length=120)
    is_active: Optional[bool] = None


class TrainerOut(BaseModel):
    id: int
    full_name: str
    contact: str
    specialty: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TrainerBrief(BaseModel):
    id: int
    full_name: str
    contact: str
    specialty: Optional[str]

    model_config = {"from_attributes": True}


class TrainerPackageCreate(BaseModel):
    category: str = Field(pattern="^(training_guidance|group_training|personal_training)$")
    name: str = Field(min_length=1, max_length=120)
    duration_months: int = Field(ge=1, le=120)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name cannot be empty")
        return cleaned


class TrainerPackageUpdate(BaseModel):
    category: Optional[str] = Field(
        default=None,
        pattern="^(training_guidance|group_training|personal_training)$",
    )
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    duration_months: Optional[int] = Field(default=None, ge=1, le=120)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    is_active: Optional[bool] = None


class TrainerPackageOut(BaseModel):
    id: int
    category: str
    name: str
    duration_months: int
    price: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TrainerPackageBrief(BaseModel):
    id: int
    category: str
    name: str
    duration_months: int
    price: Decimal

    model_config = {"from_attributes": True}


class MemberCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    contact: str = Field(min_length=1, max_length=30)
    cnic: str = Field(min_length=5, max_length=20)
    email: Optional[str] = Field(default=None, max_length=120)
    address: str = Field(min_length=1)
    package_id: int
    amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    start_date: Optional[date] = None
    trainer_package_id: Optional[int] = None
    trainer_id: Optional[int] = None
    trainer_amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    addon_fee_ids: list[int] = Field(default_factory=list)

    @field_validator("full_name", "contact", "cnic", "address")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty")
        return cleaned

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: str) -> str:
        cleaned = value.strip()
        digits = re.sub(r"\D", "", cleaned)
        if not 10 <= len(digits) <= 15:
            raise ValueError("Contact must contain 10 to 15 digits")
        return cleaned

    @field_validator("cnic")
    @classmethod
    def validate_cnic(cls, value: str) -> str:
        cleaned = value.strip()
        digits = re.sub(r"\D", "", cleaned)
        if len(digits) != 13:
            raise ValueError("CNIC must contain exactly 13 digits")
        return f"{digits[:5]}-{digits[5:12]}-{digits[12]}"

    @field_validator("email")
    @classmethod
    def strip_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class MemberUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    contact: Optional[str] = Field(default=None, min_length=1, max_length=30)
    cnic: Optional[str] = Field(default=None, min_length=5, max_length=20)
    email: Optional[str] = Field(default=None, max_length=120)
    address: Optional[str] = Field(default=None, min_length=1)
    status: Optional[str] = Field(default=None, pattern="^(active|expired|inactive)$")
    trainer_id: Optional[int] = None

    @field_validator("full_name", "contact", "cnic", "address")
    @classmethod
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty")
        return cleaned

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        digits = re.sub(r"\D", "", cleaned)
        if not 10 <= len(digits) <= 15:
            raise ValueError("Contact must contain 10 to 15 digits")
        return cleaned

    @field_validator("cnic")
    @classmethod
    def validate_cnic(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        digits = re.sub(r"\D", "", cleaned)
        if len(digits) != 13:
            raise ValueError("CNIC must contain exactly 13 digits")
        return f"{digits[:5]}-{digits[5:12]}-{digits[12]}"

    @field_validator("email")
    @classmethod
    def strip_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class MemberOut(BaseModel):
    id: int
    full_name: str
    contact: str
    cnic: str
    email: Optional[str]
    address: str
    package_id: int
    package: PackageBrief
    start_date: date
    end_date: date
    payment_status: str
    amount_due: Decimal
    amount_paid: Decimal
    trainer_package_id: Optional[int]
    trainer_package: Optional[TrainerPackageBrief]
    trainer_id: Optional[int]
    trainer: Optional[TrainerBrief]
    trainer_start_date: Optional[date]
    trainer_end_date: Optional[date]
    trainer_amount_due: Optional[Decimal]
    trainer_amount_paid: Optional[Decimal]
    trainer_payment_status: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    note: Optional[str] = Field(default=None, max_length=255)
    kind: str = Field(default="gym", pattern="^(gym|trainer)$")
    paid_at: Optional[datetime] = None

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class PaymentOut(BaseModel):
    id: int
    member_id: int
    kind: str
    amount: Decimal
    note: Optional[str]
    paid_at: datetime
    recorded_by: str
    member_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PaymentWithMember(BaseModel):
    id: int
    member_id: int
    kind: str
    amount: Decimal
    note: Optional[str]
    paid_at: datetime
    recorded_by: str
    member_name: str
    member_payment_status: Optional[str] = None
    member_trainer_payment_status: Optional[str] = None

    model_config = {"from_attributes": True}


class MemberRenewRequest(BaseModel):
    package_id: int
    amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    start_date: Optional[date] = None
    trainer_package_id: Optional[int] = None
    trainer_amount_paid: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    trainer_id: Optional[int] = None
    clear_trainer: bool = False
    addon_fee_ids: list[int] = Field(default_factory=list)


class RenewalOut(BaseModel):
    id: int
    member_id: int
    package_id: int
    package: PackageBrief
    start_date: date
    end_date: date
    amount_due: Decimal
    amount_paid: Decimal
    payment_status: str
    recorded_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertItem(BaseModel):
    member_id: int
    member_name: str
    contact: str
    alert_type: str  # expired | expiring_soon | trainer_expired | trainer_expiring_soon
    scope: str  # gym | trainer
    package_name: str
    end_date: date
    days_left: int
    payment_status: Optional[str] = None
    status: str


class AlertsResponse(BaseModel):
    expired: list[AlertItem]
    expiring_soon: list[AlertItem]
    total: int
    synced: int = 0
