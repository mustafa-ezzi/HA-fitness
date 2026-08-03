from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Package
from app.schemas import Message, PackageCreate, PackageOut, PackageUpdate

router = APIRouter(
    prefix="/api/packages",
    tags=["packages"],
    dependencies=[Depends(get_current_user)],
)


def get_package_or_404(db: Session, package_id: int) -> Package:
    package = db.get(Package, package_id)
    if package is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    return package


def ensure_name_available(db: Session, name: str, exclude_id: int | None = None) -> None:
    query = db.query(Package).filter(Package.name == name)
    if exclude_id is not None:
        query = query.filter(Package.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A package named '{name}' already exists",
        )


@router.get("", response_model=list[PackageOut])
def list_packages(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Package)
    if active_only:
        query = query.filter(Package.is_active.is_(True))
    return query.order_by(Package.duration_months, Package.name).all()


@router.post("", response_model=PackageOut, status_code=status.HTTP_201_CREATED)
def create_package(payload: PackageCreate, db: Session = Depends(get_db)):
    ensure_name_available(db, payload.name)
    package = Package(**payload.model_dump())
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@router.get("/{package_id}", response_model=PackageOut)
def get_package(package_id: int, db: Session = Depends(get_db)):
    return get_package_or_404(db, package_id)


@router.put("/{package_id}", response_model=PackageOut)
def update_package(package_id: int, payload: PackageUpdate, db: Session = Depends(get_db)):
    package = get_package_or_404(db, package_id)
    changes = payload.model_dump(exclude_unset=True)

    if "name" in changes:
        ensure_name_available(db, changes["name"], exclude_id=package_id)

    for field, value in changes.items():
        setattr(package, field, value)

    db.commit()
    db.refresh(package)
    return package


@router.delete("/{package_id}", response_model=Message)
def delete_package(package_id: int, db: Session = Depends(get_db)):
    package = get_package_or_404(db, package_id)
    name = package.name
    db.delete(package)
    db.commit()
    return Message(message=f"Package '{name}' deleted")


@router.post("/{package_id}/toggle", response_model=PackageOut)
def toggle_package(package_id: int, db: Session = Depends(get_db)):
    package = get_package_or_404(db, package_id)
    package.is_active = not package.is_active
    db.commit()
    db.refresh(package)
    return package
