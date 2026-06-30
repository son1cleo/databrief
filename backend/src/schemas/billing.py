from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    plan: str  # starter | growth | business


class CheckoutResponse(BaseModel):
    url: str


class PortalResponse(BaseModel):
    url: str


class UsageResponse(BaseModel):
    plan: str
    reports_used: int
    reports_limit: int
    reports_remaining: int
    overage_cents: int | None
