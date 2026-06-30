from sqlalchemy.orm import Session

from src.models.user import User
from src.schemas.user import UserSyncRequest


def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def upsert_from_oauth(db: Session, data: UserSyncRequest) -> User:
    user = get_by_email(db, data.email)
    if user is None:
        user = User(
            email=data.email,
            name=data.name,
            avatar_url=data.avatar_url,
            provider=data.provider,
        )
        db.add(user)
    else:
        user.name = data.name or user.name
        user.avatar_url = data.avatar_url or user.avatar_url
        user.provider = data.provider

    db.commit()
    db.refresh(user)
    return user
