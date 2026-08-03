"""SQLite-friendly helpers for additive schema changes."""

from sqlalchemy import text

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
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(members)")).fetchall()
        if not rows:
            return
        existing = {row[1] for row in rows}
        for column, sql_type in MEMBER_COLUMNS.items():
            if column not in existing:
                conn.execute(text(f"ALTER TABLE members ADD COLUMN {column} {sql_type}"))
                print(f"Added members.{column}")
