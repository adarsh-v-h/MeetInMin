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

# Dependency to yield database sessions to our FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
