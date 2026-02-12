from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def user_to_response(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "has_api_key": bool(user.anthropic_api_key),
        "created_at": user.created_at,
    }


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user_to_response(user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.anthropic_api_key is not None:
        user.anthropic_api_key = data.anthropic_api_key
    await db.commit()
    return user_to_response(user)
