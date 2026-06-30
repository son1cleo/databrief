from celery import Celery

from src.core.config import settings

celery_app = Celery("databrief", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]


@celery_app.task(name="generate_report")
def generate_report_task(report_id: str) -> None:
    """Runs the analysis -> insight -> story -> export pipeline for a report.

    Placeholder until Phase 6 (analysis/insight/story/llm services) and
    Phase 7 (PDF/Word/PPTX export) are wired in — for now it just proves the
    upload -> Celery -> DB -> poll loop works end-to-end.
    """
    from src.core.database import SessionLocal
    from src.models.report import Report

    db = SessionLocal()
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if report is None:
            return
        report.title = "Untitled Report"
        report.hook = "Your story is on its way."
        report.story_html = "<p>Report generation pipeline coming in a later phase.</p>"
        report.word_count = 0
        report.findings_count = 0
        report.status = "done"
        db.commit()
    finally:
        db.close()
