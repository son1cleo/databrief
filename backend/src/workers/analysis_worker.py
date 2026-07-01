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
def generate_report_task(
    report_id: str,
    industry: str | None = None,
    question: str | None = None,
    formats: list[str] | None = None,
) -> None:
    """The full pipeline: load the upload -> run stats/insight/story/LLM
    services -> build the requested export files -> persist everything
    onto the Report row."""
    from src.core.database import SessionLocal
    from src.models.report import Report
    from src.models.upload import Upload
    from src.models.user import User
    from src.services import (
        analysis_service,
        chart_service,
        file_service,
        insight_service,
        llm_service,
        pdf_service,
        pptx_service,
        story_service,
        word_service,
    )

    formats = formats or ["pdf"]
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

            column_meta: dict = {}
            if question:
                sample_values = {col: df[col].dropna().head(5).tolist() for col in df.columns}
                column_meta = llm_service.identify_relevant_columns(
                    question=question,
                    columns=df.columns.tolist(),
                    sample_values=sample_values,
                )

            relevant_cols = column_meta.get("relevant_cols") or []
            question_type = column_meta.get("question_type") or None
            independent_var = column_meta.get("independent_var")
            dependent_var = column_meta.get("dependent_var")

            # Auto-compute change columns for pre/post pairs so they're first-class columns
            change_cols_added = []
            for col in list(df.columns):
                if any(p in col.lower() for p in ["post_", "_post", "after_"]):
                    pre_col = analysis_service._find_pre_column(df, col)
                    if pre_col:
                        change_col = f"change_{col}"
                        df[change_col] = df[col] - df[pre_col]
                        change_cols_added.append(change_col)
            if change_cols_added and question:
                improve_words = {"better", "worse", "improve", "change", "help", "hurt", "impact", "affect"}
                if any(w in question.lower() for w in improve_words):
                    relevant_cols = relevant_cols + change_cols_added

            findings = analysis_service.analyze(
                df,
                question=question,
                relevant_cols=relevant_cols,
                question_type=question_type,
                independent_var=independent_var,
                dependent_var=dependent_var,
            )
            top_findings = insight_service.rank_findings(findings, relevant_cols=relevant_cols)
            for finding in top_findings:
                chart_b64 = chart_service.chart_for_finding(finding.to_dict(), df)
                if chart_b64:
                    finding.extra["chart_b64"] = chart_b64
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
        db.flush()  # exporters read report.story_html/title, so persist before building files

        user = db.query(User).filter(User.id == report.user_id).first()

        report.pdf_path = pdf_service.build_pdf(report, user)
        if "word" in formats:
            report.word_path = word_service.build_word(report)
        if "pptx" in formats:
            report.pptx_path = pptx_service.build_pptx(report, user, story_arc)

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
