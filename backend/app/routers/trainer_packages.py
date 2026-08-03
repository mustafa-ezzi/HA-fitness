from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import TrainerPackage
from app.schemas import Message, TrainerPackageCreate, TrainerPackageOut, TrainerPackageUpdate

router = APIRouter(
    prefix="/api/trainer-packages",
    tags=["trainer-packages"],
    dependencies=[Depends(get_current_user)],
)


def get_tp_or_404(db: Session, package_id: int) -> TrainerPackage:
    package = db.get(TrainerPackage, package_id)
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer package not found")
    return package


@router.get("", response_model=list[TrainerPackageOut])
def list_trainer_packages(
    active_only: bool = False,
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(TrainerPackage)
    if active_only:
        query = query.filter(TrainerPackage.is_active.is_(True))
    if category:
        query = query.filter(TrainerPackage.category == category)
    return query.order_by(TrainerPackage.category, TrainerPackage.duration_months).all()


@router.post("", response_model=TrainerPackageOut, status_code=status.HTTP_201_CREATED)
def create_trainer_package(payload: TrainerPackageCreate, db: Session = Depends(get_db)):
    if db.query(TrainerPackage).filter(TrainerPackage.name == payload.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Package name already exists")
    package = TrainerPackage(**payload.model_dump())
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@router.put("/{package_id}", response_model=TrainerPackageOut)
def update_trainer_package(
    package_id: int,
    payload: TrainerPackageUpdate,
    db: Session = Depends(get_db),
):
    package = get_tp_or_404(db, package_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        clash = (
            db.query(TrainerPackage)
            .filter(TrainerPackage.name == changes["name"], TrainerPackage.id != package_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Package name already exists")
    for field, value in changes.items():
        setattr(package, field, value)
    db.commit()
    db.refresh(package)
    return package


@router.post("/{package_id}/toggle", response_model=TrainerPackageOut)
def toggle_trainer_package(package_id: int, db: Session = Depends(get_db)):
    package = get_tp_or_404(db, package_id)
    package.is_active = not package.is_active
    db.commit()
    db.refresh(package)
    return package


@router.delete("/{package_id}", response_model=Message)
def delete_trainer_package(package_id: int, db: Session = Depends(get_db)):
    package = get_tp_or_404(db, package_id)
    name = package.name
    db.delete(package)
    db.commit()
    return Message(message=f"Trainer package '{name}' deleted")
