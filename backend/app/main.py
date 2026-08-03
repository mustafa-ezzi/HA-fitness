from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.migrate import ensure_schema
from app.routers import alerts, auth, fees, members, packages, payments, trainer_packages, trainers
from app.schemas import HealthResponse
from app.seed import (
    cleanup_duplicate_trainer_packages,
    seed_admin,
    seed_fee_items,
    seed_packages,
    seed_trainer_packages,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    seed_admin()
    seed_packages()
    seed_trainer_packages()
    cleanup_duplicate_trainer_packages()
    seed_fee_items()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

cors_origins = [
    origin.strip().rstrip("/")
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(packages.router)
app.include_router(members.router)
app.include_router(fees.router)
app.include_router(trainers.router)
app.include_router(trainer_packages.router)
app.include_router(payments.router)
app.include_router(alerts.router)


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", app=settings.app_name)
