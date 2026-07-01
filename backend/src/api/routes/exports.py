import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, get_db
from src.core.config import settings
from src.models.user import User
from src.repositories import report_repo

router = APIRouter(prefix="/api/exports", tags=["exports"])

MEDIA_TYPES = {
    "pdf": "application/pdf",
    "word": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
EXTENSIONS = {"pdf": "pdf", "word": "docx", "pptx": "pptx"}
PATH_FIELDS = {"pdf": "pdf_path", "word": "word_path", "pptx": "pptx_path"}


def _stream(report_id: uuid.UUID, fmt: str, db: Session, current_user: User):
    report = report_repo.get_for_user(db, report_id, current_user.id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    object_key = getattr(report, PATH_FIELDS[fmt])
    if not object_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{fmt} export not available yet")

    filename = f"{(report.title or 'databrief-report')[:60]}.{EXTENSIONS[fmt]}"

    if not settings.r2_account_id:
        # Local dev: object_key is a filesystem path
        if not Path(object_key).exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found locally")
        return FileResponse(object_key, media_type=MEDIA_TYPES[fmt], filename=filename)

    from src.services import storage_service
    url = storage_service.presigned_download_url(object_key, filename=filename)
    return RedirectResponse(url=url, status_code=302)


@router.get("/{report_id}/pdf")
def export_pdf(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _stream(report_id, "pdf", db, current_user)


@router.get("/{report_id}/word")
def export_word(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _stream(report_id, "word", db, current_user)


@router.get("/{report_id}/pptx")
def export_pptx(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _stream(report_id, "pptx", db, current_user)
