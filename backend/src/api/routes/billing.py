from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.api.deps import get_current_user, get_db
from src.core.config import settings
from src.models.user import User
from src.schemas.billing import CheckoutRequest, CheckoutResponse, PortalResponse, UsageResponse
from src.services import billing_service

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.plan not in ("starter", "growth", "business"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid plan")

    import stripe

    try:
        url = billing_service.create_checkout_session(
            current_user,
            payload.plan,
            success_url=f"{settings.frontend_url}/settings/billing?checkout=success",
            cancel_url=f"{settings.frontend_url}/settings/billing?checkout=cancelled",
            db=db,
        )
    except billing_service.StripeNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe error: {exc}") from exc

    return CheckoutResponse(url=url)


@router.get("/portal", response_model=PortalResponse)
def get_portal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import stripe

    try:
        url = billing_service.create_portal_session(
            current_user, return_url=f"{settings.frontend_url}/settings/billing", db=db
        )
    except billing_service.StripeNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe error: {exc}") from exc

    return PortalResponse(url=url)


@router.get("/usage", response_model=UsageResponse)
def get_usage(current_user: User = Depends(get_current_user)):
    overage_cents = billing_service.PLAN_LIMITS.get(current_user.plan, {}).get("overage_cents")
    return UsageResponse(
        plan=current_user.plan,
        reports_used=current_user.reports_used,
        reports_limit=current_user.reports_limit,
        reports_remaining=max(current_user.reports_limit - current_user.reports_used, 0),
        overage_cents=overage_cents,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.stripe_webhook_secret or not settings.stripe_secret_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe not configured")

    import stripe

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature") from exc

    billing_service.handle_webhook_event(event, db)
    return {"received": True}
