from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import FeeItem
from app.schemas import FeeItemCreate, FeeItemOut, FeeItemUpdate, Message

router = APIRouter(
    prefix="/api/fees",
    tags=["fees"],
    dependencies=[Depends(get_current_user)],
)


def get_fee_or_404(db: Session, fee_id: int) -> FeeItem:
    fee = db.get(FeeItem, fee_id)
    if fee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee item not found")
    return fee


@router.get("", response_model=list[FeeItemOut])
def list_fees(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(FeeItem)
    if active_only:
        query = query.filter(FeeItem.is_active.is_(True))
    return query.order_by(FeeItem.sort_order, FeeItem.name).all()


@router.post("", response_model=FeeItemOut, status_code=status.HTTP_201_CREATED)
def create_fee(payload: FeeItemCreate, db: Session = Depends(get_db)):
    if db.query(FeeItem).filter(FeeItem.name == payload.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Fee name already exists")
    fee = FeeItem(**payload.model_dump())
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return fee


@router.put("/{fee_id}", response_model=FeeItemOut)
def update_fee(fee_id: int, payload: FeeItemUpdate, db: Session = Depends(get_db)):
    fee = get_fee_or_404(db, fee_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        clash = (
            db.query(FeeItem)
            .filter(FeeItem.name == changes["name"], FeeItem.id != fee_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Fee name already exists")
    for field, value in changes.items():
        setattr(fee, field, value)
    db.commit()
    db.refresh(fee)
    return fee


@router.delete("/{fee_id}", response_model=Message)
def delete_fee(fee_id: int, db: Session = Depends(get_db)):
    fee = get_fee_or_404(db, fee_id)
    name = fee.name
    db.delete(fee)
    db.commit()
    return Message(message=f"Fee '{name}' deleted")
