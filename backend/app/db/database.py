from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os

# For development, we will use a local SQLite database to get moving quickly.
# We will swap this out for PostgreSQL via environment variables later.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./meetinmin.db")

# connect_args={"check_same_thread": False} is needed only for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autoflush=False, bind=engine)

Base = declarative_base()

def run_auto_migrations(db_engine):
    from sqlalchemy import text
    columns_to_add = [
        ('meeting_insights', 'summary_json', 'TEXT'),
        ('action_items', 'confidence_score', 'FLOAT DEFAULT 0.5'),
        ('action_items', 'confidence_reason', 'TEXT'),
        ('key_decisions', 'confidence_score', 'FLOAT DEFAULT 0.5'),
        ('key_decisions', 'confidence_reason', 'TEXT'),
    ]
    with db_engine.connect() as conn:
        for table, col, col_type in columns_to_add:
            try:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {col_type};'))
                conn.commit()
            except Exception:
                pass

# Run automatic schema migration on startup to ensure backward compatibility
run_auto_migrations(engine)

# Dependency to yield database sessions to our FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
