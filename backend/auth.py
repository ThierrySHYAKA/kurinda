"""
Kurinda authentication.

Password hashing (bcrypt) and signed access tokens (JWT) for the three user
roles: district_officer, chw_supervisor, chw. Tokens are stateless — no
server-side session table — so validating one only needs the shared secret,
not a database round trip, except to load the current user's own row.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from db import engine
from models import User

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# tokenUrl is metadata for the OpenAPI docs only — login itself takes JSON,
# not the OAuth2 form body this class is named after.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: int, role: str) -> str:
    if not SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY is not configured")
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token or not SECRET_KEY:
        raise unauthorized
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise unauthorized

    if engine is None:
        raise HTTPException(status_code=503, detail="Database not configured")

    with Session(engine) as session:
        user = session.get(User, user_id)
        if user is None:
            raise unauthorized
        return user


def require_roles(*roles: str):
    """Dependency factory: 403s unless the current user has one of `roles`."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this action",
            )
        return user

    return dependency
