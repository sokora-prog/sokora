from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Charger .env local si présent (développement local sans Docker)
try:
    from dotenv import load_dotenv
    import pathlib
    _env = pathlib.Path(__file__).parent.parent / ".env"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    pass

# psycopg2-binary est installé dans le Dockerfile → on utilise postgresql+psycopg2
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/sokora_db"
)

# SQLite accepte une connexion depuis le seul thread qui l'a ouverte ; or
# FastAPI sert les requêtes depuis un pool de threads. `check_same_thread`
# lève cette contrainte, ce qui est sans danger ici : SQLAlchemy sérialise
# déjà les accès par session. Sans cela, une installation locale sans
# PostgreSQL échoue dès la première requête.
_connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
