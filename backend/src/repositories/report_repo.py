import uuid

from sqlalchemy.orm import Session

from src.models.report import Report


def create(db: Session, **kwargs) -> Report:
    report = Report(**kwargs)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_for_user(db: Session, report_id: uuid.UUID, user_id: uuid.UUID) -> Report | None:
    return (
        db.query(Report)
        .filter(Report.id == report_id, Report.user_id == user_id)
        .first()
    )


def list_for_user(db: Session, user_id: uuid.UUID, limit: int = 20, offset: int = 0) -> list[Report]:
    return (
        db.query(Report)
        .filter(Report.user_id == user_id)
        .order_by(Report.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def delete(db: Session, report: Report) -> None:
    db.delete(report)
    db.commit()
