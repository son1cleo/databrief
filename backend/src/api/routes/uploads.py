import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, get_db
from src.core.config import settings
from src.models.user import User
from src.repositories import upload_repo
from src.schemas.upload import UploadPreview, UploadStatusOut
from src.services import file_service

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", response_model=UploadPreview)
async def create_upload(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    file_bytes = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds {settings.max_file_size_mb}MB limit",
        )

    try:
        file_type = file_service.detect_file_type(file.filename)
    except file_service.UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    data_type = file_service.detect_data_type(file_type)

    storage_path, size = file_service.save_upload(
        file_bytes, file.filename, str(current_user.id), settings.upload_dir
    )

    try:
        preview = file_service.parse_preview(storage_path, file_type)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse file: {exc}",
        ) from exc

    upload = upload_repo.create(
        db,
        user_id=current_user.id,
        filename=file.filename,
        file_type=file_type,
        data_type=data_type,
        file_size_bytes=size,
        row_count=preview.get("row_count"),
        column_count=preview.get("column_count"),
        storage_path=storage_path,
        status="done",
    )

    return UploadPreview(
        upload_id=upload.id,
        columns=preview.get("columns", []),
        rows=preview.get("rows", []),
        text_preview=preview.get("text_preview"),
        file_type=file_type,
        data_type=data_type,
        row_count=preview.get("row_count"),
        column_count=preview.get("column_count"),
    )


@router.get("/{upload_id}/status", response_model=UploadStatusOut)
def get_upload_status(
    upload_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = upload_repo.get_for_user(db, upload_id, current_user.id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    return UploadStatusOut(upload_id=upload.id, status=upload.status, message=upload.error_message)
