import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, get_db
from src.models.user import User
from src.repositories import report_repo, upload_repo
from src.schemas.report import ReportConfigRequest, ReportListItem, ReportOut
from src.workers.analysis_worker import generate_report_task

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload = upload_repo.get_for_user(db, payload.upload_id, current_user.id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

    if current_user.plan != "business" and current_user.reports_used >= current_user.reports_limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Report limit reached for your plan. Upgrade to generate more reports.",
        )

    report = report_repo.create(
        db,
        user_id=current_user.id,
        upload_id=upload.id,
        pptx_theme=payload.pptx_theme,
        is_branded=payload.apply_brand_kit,
        status="generating",
    )

    current_user.reports_used += 1
    db.commit()

    generate_report_task.delay(str(report.id))

    db.refresh(report)
    return report


@router.get("", response_model=list[ReportListItem])
def list_reports(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return report_repo.list_for_user(db, current_user.id, limit=limit, offset=offset)


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = report_repo.get_for_user(db, report_id, current_user.id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = report_repo.get_for_user(db, report_id, current_user.id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report_repo.delete(db, report)
