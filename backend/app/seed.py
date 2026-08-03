from decimal import Decimal

from app.auth import hash_password
from app.database import SessionLocal
from app.models import FeeItem, Package, TrainerPackage, TrainerPackageCategory, User

DEFAULT_PACKAGES = [
    ("1 Month", 1, Decimal("3000.00")),
    ("3 Months", 3, Decimal("8000.00")),
    ("6 Months", 6, Decimal("15000.00")),
    ("12 Months", 12, Decimal("28000.00")),
]

# Group 1-month uses 7000 to match fee table (group train 7000).
DEFAULT_TRAINER_PACKAGES = [
    (TrainerPackageCategory.TRAINING_GUIDANCE.value, "Training Guidance - 1 Month", 1, Decimal("2500.00")),
    (TrainerPackageCategory.TRAINING_GUIDANCE.value, "Training Guidance - 2 Months", 2, Decimal("6000.00")),
    (TrainerPackageCategory.TRAINING_GUIDANCE.value, "Training Guidance - 6 Months", 6, Decimal("11000.00")),
    (TrainerPackageCategory.GROUP_TRAINING.value, "Group Training - 1 Month", 1, Decimal("7000.00")),
    (TrainerPackageCategory.GROUP_TRAINING.value, "Group Training - 2 Months", 2, Decimal("18000.00")),
    (TrainerPackageCategory.GROUP_TRAINING.value, "Group Training - 6 Months", 6, Decimal("33000.00")),
    (TrainerPackageCategory.PERSONAL_TRAINING.value, "Personal Training - 1 Month", 1, Decimal("12000.00")),
    (TrainerPackageCategory.PERSONAL_TRAINING.value, "Personal Training - 2 Months", 2, Decimal("30000.00")),
    (TrainerPackageCategory.PERSONAL_TRAINING.value, "Personal Training - 6 Months", 6, Decimal("54000.00")),
]

DEFAULT_FEE_ITEMS = [
    ("Admission", Decimal("2500.00"), "one-time", "New member admission fee", 1),
    ("Monthly", Decimal("2500.00"), "per month", "Standard monthly gym fee", 2),
    ("Gym + Treadmill", Decimal("4500.00"), "per month", None, 3),
    ("Per Day Treadmill", Decimal("500.00"), "per day", None, 4),
    ("Training Guidance", Decimal("2500.00"), "per month", "Monthly rate reference", 5),
    ("Group Train", Decimal("7000.00"), "per month", "Monthly rate reference", 6),
    ("Personal Train", Decimal("12000.00"), "per month", "Monthly rate reference", 7),
]


def seed_admin() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "admin").first()
        if existing:
            return

        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("Admin user created: admin / admin123")
    finally:
        db.close()


def seed_packages() -> None:
    db = SessionLocal()
    try:
        created = 0
        for name, duration_months, price in DEFAULT_PACKAGES:
            exists = db.query(Package).filter(Package.name == name).first()
            if exists:
                continue
            db.add(
                Package(
                    name=name,
                    duration_months=duration_months,
                    price=price,
                    is_active=True,
                )
            )
            created += 1

        if created:
            db.commit()
            print(f"Seeded {created} default package(s).")
    finally:
        db.close()


def seed_trainer_packages() -> None:
    db = SessionLocal()
    try:
        created = 0
        for category, name, duration_months, price in DEFAULT_TRAINER_PACKAGES:
            exists = db.query(TrainerPackage).filter(TrainerPackage.name == name).first()
            if exists:
                continue
            db.add(
                TrainerPackage(
                    category=category,
                    name=name,
                    duration_months=duration_months,
                    price=price,
                    is_active=True,
                )
            )
            created += 1

        if created:
            db.commit()
            print(f"Seeded {created} trainer package(s).")
    finally:
        db.close()


def cleanup_duplicate_trainer_packages() -> None:
    """Keep one package per category + duration; normalize old em-dash names."""
    from app.models import Member

    db = SessionLocal()
    try:
        packages = db.query(TrainerPackage).order_by(TrainerPackage.id).all()
        keep_by_key: dict[tuple[str, int], TrainerPackage] = {}
        removed = 0

        for pkg in packages:
            # Normalize fancy dashes in existing names
            cleaned_name = pkg.name.replace("—", "-").replace("–", "-").strip()
            if cleaned_name != pkg.name:
                pkg.name = cleaned_name

            key = (pkg.category, pkg.duration_months)
            keeper = keep_by_key.get(key)
            if keeper is None:
                keep_by_key[key] = pkg
                continue

            # Re-point members to the kept package, then drop the duplicate
            for member in db.query(Member).filter(Member.trainer_package_id == pkg.id).all():
                member.trainer_package_id = keeper.id
            db.delete(pkg)
            removed += 1

        # Prefer canonical names from seed defaults when present
        defaults = {(c, d): n for c, n, d, _ in DEFAULT_TRAINER_PACKAGES}
        for key, pkg in keep_by_key.items():
            if key in defaults and pkg.name != defaults[key]:
                clash = (
                    db.query(TrainerPackage)
                    .filter(TrainerPackage.name == defaults[key], TrainerPackage.id != pkg.id)
                    .first()
                )
                if clash is None:
                    pkg.name = defaults[key]

        if removed:
            db.commit()
            print(f"Removed {removed} duplicate trainer package(s).")
        else:
            db.commit()
    finally:
        db.close()


def seed_fee_items() -> None:
    db = SessionLocal()
    try:
        created = 0
        for name, price, unit, notes, sort_order in DEFAULT_FEE_ITEMS:
            exists = db.query(FeeItem).filter(FeeItem.name == name).first()
            if exists:
                continue
            db.add(
                FeeItem(
                    name=name,
                    price=price,
                    unit=unit,
                    notes=notes,
                    sort_order=sort_order,
                    is_active=True,
                )
            )
            created += 1

        if created:
            db.commit()
            print(f"Seeded {created} fee table item(s).")
    finally:
        db.close()
