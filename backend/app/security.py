import bcrypt
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from . import models

# ─────────────────────────────────────────
#  CONFIG JWT
# ─────────────────────────────────────────

SECRET_KEY    = os.getenv("SECRET_KEY", "change-this-secret-in-production")
ALGORITHM     = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24   # 24h

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─────────────────────────────────────────
#  MOT DE PASSE
# ─────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception as e:
        print(f"Erreur bcrypt: {e}")
        return False


def get_password_hash(password: str) -> str:
    salt   = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


# ─────────────────────────────────────────
#  JWT — CRÉATION & DÉCODAGE
# ─────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire    = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ─────────────────────────────────────────
#  DÉPENDANCES FASTAPI
# ─────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    payload = decode_token(token)
    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token invalide")

    user = db.get(models.User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable ou désactivé")
    return user


def require_roles(*roles: models.UserRole):
    """Décorateur de dépendance pour restreindre l'accès par rôle."""
    def dependency(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôle requis : {[r.value for r in roles]}"
            )
        return current_user
    return dependency


# Raccourcis pratiques
require_super_admin = require_roles(models.UserRole.SUPER_ADMIN)
require_manager     = require_roles(models.UserRole.MANAGER, models.UserRole.SUPER_ADMIN)
require_waiter      = require_roles(models.UserRole.WAITER, models.UserRole.MANAGER, models.UserRole.SUPER_ADMIN)


def get_current_client(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    payload = decode_token(token)
    client_id = payload.get("sub")
    if client_id is None:
        raise HTTPException(status_code=401, detail="Token invalide")
    client = db.query(models.ClientAccount).filter(models.ClientAccount.id == int(client_id)).first()
    if not client:
        raise HTTPException(status_code=401, detail="Client introuvable")
    return client
