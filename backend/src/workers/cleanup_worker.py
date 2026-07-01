"""Scheduled cleanup: delete uploads and reports older than 30 days from R2 and DB."""
from celery import Celery
from celery.schedules import crontab

from src.core.config import settings

celery_app = Celery("databrief_beat", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]

celery_app.conf.beat_schedule = {
    "delete-old-files-daily": {
        "task": "delete_old_files",
        "schedule": crontab(hour=3, minute=0),
    },
}


@celery_app.task(name="delete_old_files")
def delete_old_files() -> None:
    from datetime import datetime, timedelta, timezone

    from src.core.database import SessionLocal
    from src.models.report import Report
    from src.models.upload import Upload
    from src.services import storage_service

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    db = SessionLocal()
    try:
        for upload in db.query(Upload).filter(Upload.created_at < cutoff).all():
            storage_service.delete_object(upload.storage_path)
            db.delete(upload)

        for report in db.query(Report).filter(Report.created_at < cutoff).all():
            storage_service.delete_prefix(f"reports/{report.id}/")
            db.delete(report)

        db.commit()
    finally:
        db.close()
