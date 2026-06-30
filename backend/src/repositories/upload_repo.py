import uuid

from sqlalchemy.orm import Session

from src.models.upload import Upload


def create(db: Session, **kwargs) -> Upload:
    upload = Upload(**kwargs)
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def get_for_user(db: Session, upload_id: uuid.UUID, user_id: uuid.UUID) -> Upload | None:
    return (
        db.query(Upload)
        .filter(Upload.id == upload_id, Upload.user_id == user_id)
        .first()
    )


def update_status(db: Session, upload: Upload, status: str, error_message: str | None = None) -> Upload:
    upload.status = status
    if error_message is not None:
        upload.error_message = error_message
    db.commit()
    db.refresh(upload)
    return upload
