"""Additive schema helpers that work on SQLite and PostgreSQL."""

from sqlalchemy import inspect, text

from app.database import engine


MEMBER_COLUMNS = {
    "trainer_package_id": "INTEGER",
    "trainer_id": "INTEGER",
    "trainer_start_date": "DATE",
    "trainer_end_date": "DATE",
    "trainer_amount_due": "NUMERIC(10,2)",
    "trainer_amount_paid": "NUMERIC(10,2)",
    "trainer_payment_status": "VARCHAR(20)",
}


def ensure_schema() -> None:
    inspector = inspect(engine)
    if "members" not in inspector.get_table_names():
        return

    existing = {col["name"] for col in inspector.get_columns("members")}
    with engine.begin() as conn:
        for column, sql_type in MEMBER_COLUMNS.items():
            if column not in existing:
                conn.execute(text(f"ALTER TABLE members ADD COLUMN {column} {sql_type}"))
                print(f"Added members.{column}")
