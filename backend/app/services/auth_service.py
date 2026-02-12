from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {"sub": user_id, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    payload = {"sub": user_id, "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def register_user(
    db: AsyncSession, email: str, password: str, display_name: str
) -> User:
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        email=email,
        display_name=display_name,
        hashed_password=hash_password(password),
    )
    db.add(user)
    await db.flush()

    # Auto-create personal drive (workspace)
    drive = Workspace(
        name=f"{display_name}'s Drive",
        slug=f"drive-{user.id}",
        description="Personal drive",
        owner_id=user.id,
    )
    db.add(drive)
    await db.flush()

    member = WorkspaceMember(
        workspace_id=drive.id,
        user_id=user.id,
        role="owner",
    )
    db.add(member)
    await db.flush()

    return user


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or user.hashed_password is None:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
