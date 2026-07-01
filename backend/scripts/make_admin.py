"""Run inside the api container to promote a user to the business plan (unlimited reports).

Usage:
    docker compose exec api python scripts/make_admin.py your@email.com
"""
import sys

from src.core.database import SessionLocal
from src.models.user import User


def promote(email: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"No user found with email: {email}")
            sys.exit(1)
        user.plan = "business"
        user.reports_limit = 10**9
        user.reports_used = 0
        db.commit()
        print(f"Done — {email} is now on the business plan (unlimited reports).")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/make_admin.py your@email.com")
        sys.exit(1)
    promote(sys.argv[1])
