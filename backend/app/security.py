import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Header, HTTPException

JWT_ALGORITHM = "HS256"


def _jwt_secret():
    return os.environ["JWT_SECRET"]


def _parse_expiry(exp_str: Optional[str]) -> timedelta:
    if not exp_str:
        return timedelta(days=7)
    m = re.match(r"^(\d+)\s*([smhd])$", exp_str.strip())
    if not m:
        return timedelta(days=7)
    n, unit = int(m.group(1)), m.group(2)
    return {
        "s": timedelta(seconds=n),
        "m": timedelta(minutes=n),
        "h": timedelta(hours=n),
        "d": timedelta(days=n),
    }[unit]


def create_token(payload: dict, expires_in: Optional[str] = None) -> str:
    to_encode = dict(payload)
    to_encode["exp"] = datetime.now(timezone.utc) + _parse_expiry(
        expires_in if expires_in is not None else os.environ.get("JWT_EXPIRES_IN")
    )
    return jwt.encode(to_encode, _jwt_secret(), algorithm=JWT_ALGORITHM)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or " " not in authorization:
        raise HTTPException(status_code=401, detail="No token provided")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


def admin_only(authorization: Optional[str] = Header(default=None)) -> dict:
    user = get_current_user(authorization)
    role = (user.get("role") or "").lower()
    if role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
