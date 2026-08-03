"""Run manually from the backend folder: py seed.py"""

from app.database import Base, engine
from app.migrate import ensure_schema
from app.seed import seed_admin, seed_fee_items, seed_packages, seed_trainer_packages

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    seed_admin()
    seed_packages()
    seed_trainer_packages()
    seed_fee_items()
    print("Seed complete.")
