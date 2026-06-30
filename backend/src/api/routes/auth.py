from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, get_db
from src.models.user import User
from src.repositories import user_repo
from src.schemas.user import UserOut, UserSyncRequest, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/sync", response_model=UserOut)
def sync_user(payload: UserSyncRequest, db: Session = Depends(get_db)):
    """Upsert a user record from a NextAuth OAuth callback (Google or GitHub)."""
    return user_repo.upsert_from_oauth(db, payload)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
