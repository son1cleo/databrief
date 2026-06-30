from celery import Celery

from src.core.config import settings

celery_app = Celery("databrief", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]


def _derive_title(hook: str) -> str:
    title = hook.strip().rstrip(".")
    return title if len(title) <= 70 else title[:67] + "..."


@celery_app.task(name="generate_report")
def generate_report_task(report_id: str, industry: str | None = None, question: str | None = None) -> None:
    """The full pipeline: load the upload -> run stats/insight/story/LLM
    services -> persist the finished story onto the Report row."""
    from src.core.database import SessionLocal
    from src.models.report import Report
    from src.models.upload import Upload
    from src.services import analysis_service, file_service, insight_service, llm_service, story_service

    db = SessionLocal()
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if report is None:
            return

        upload = db.query(Upload).filter(Upload.id == report.upload_id).first()
        if upload is None:
            report.status = "failed"
            report.error_message = "Source upload no longer exists"
            db.commit()
            return

        if upload.data_type in ("structured", "semi_structured"):
            df = file_service.load_dataframe(upload.storage_path, upload.file_type)
            findings = analysis_service.analyze(df)
            top_findings = insight_service.rank_findings(findings)
            story_arc = story_service.build_story_arc(
                top_findings,
                row_count=len(df),
                column_count=len(df.columns),
                columns=df.columns.tolist(),
                question=question,
            )
            findings_count = len(top_findings)
        else:
            text = file_service.load_text(upload.storage_path, upload.file_type)
            story_arc = story_service.build_text_story_arc(text, question=question)
            findings_count = 0

        story_html, word_count = llm_service.generate_story_html(story_arc, industry=industry, question=question)

        report.title = _derive_title(story_arc["hook"])
        report.hook = story_arc["hook"]
        report.story_json = story_arc
        report.story_html = story_html
        report.word_count = word_count
        report.findings_count = findings_count
        report.status = "done"
        db.commit()
    except Exception as exc:  # noqa: BLE001 — surface any pipeline failure onto the report row
        db.rollback()
        report = db.query(Report).filter(Report.id == report_id).first()
        if report is not None:
            report.status = "failed"
            report.error_message = str(exc)[:500]
            db.commit()
        raise
    finally:
        db.close()
