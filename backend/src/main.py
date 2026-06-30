from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import auth, exports, health, reports, uploads
from src.core.config import settings

app = FastAPI(title="DataBrief API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(reports.router)
app.include_router(exports.router)
