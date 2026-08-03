from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Trainer
from app.schemas import Message, TrainerCreate, TrainerOut, TrainerUpdate

router = APIRouter(
    prefix="/api/trainers",
    tags=["trainers"],
    dependencies=[Depends(get_current_user)],
)


def get_trainer_or_404(db: Session, trainer_id: int) -> Trainer:
    trainer = db.get(Trainer, trainer_id)
    if trainer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")
    return trainer


@router.get("", response_model=list[TrainerOut])
def list_trainers(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Trainer)
    if active_only:
        query = query.filter(Trainer.is_active.is_(True))
    return query.order_by(Trainer.full_name).all()


@router.post("", response_model=TrainerOut, status_code=status.HTTP_201_CREATED)
def create_trainer(payload: TrainerCreate, db: Session = Depends(get_db)):
    trainer = Trainer(**payload.model_dump())
    db.add(trainer)
    db.commit()
    db.refresh(trainer)
    return trainer


@router.put("/{trainer_id}", response_model=TrainerOut)
def update_trainer(trainer_id: int, payload: TrainerUpdate, db: Session = Depends(get_db)):
    trainer = get_trainer_or_404(db, trainer_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(trainer, field, value)
    db.commit()
    db.refresh(trainer)
    return trainer


@router.post("/{trainer_id}/toggle", response_model=TrainerOut)
def toggle_trainer(trainer_id: int, db: Session = Depends(get_db)):
    trainer = get_trainer_or_404(db, trainer_id)
    trainer.is_active = not trainer.is_active
    db.commit()
    db.refresh(trainer)
    return trainer


@router.delete("/{trainer_id}", response_model=Message)
def delete_trainer(trainer_id: int, db: Session = Depends(get_db)):
    trainer = get_trainer_or_404(db, trainer_id)
    name = trainer.full_name
    db.delete(trainer)
    db.commit()
    return Message(message=f"Trainer '{name}' deleted")
