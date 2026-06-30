import logging

from sqlalchemy.orm import Session

from src.core.config import settings
from src.models.user import User

logger = logging.getLogger(__name__)

# plan -> (included reports per period, monthly price in cents, overage price in cents)
PLAN_LIMITS = {
    "free": {"reports_limit": 3, "overage_cents": None},
    "starter": {"reports_limit": 20, "overage_cents": 300},
    "growth": {"reports_limit": 100, "overage_cents": 200},
    "business": {"reports_limit": 10**9, "overage_cents": None},  # effectively unlimited
}


class StripeNotConfiguredError(Exception):
    pass


def _client():
    if not settings.stripe_secret_key:
        raise StripeNotConfiguredError("STRIPE_SECRET_KEY is not configured")
    import stripe

    stripe.api_key = settings.stripe_secret_key
    return stripe


def _price_id_for_plan(plan: str) -> str:
    mapping = {
        "starter": settings.stripe_starter_price_id,
        "growth": settings.stripe_growth_price_id,
        "business": settings.stripe_business_price_id,
    }
    price_id = mapping.get(plan)
    if not price_id:
        raise ValueError(f"No Stripe price configured for plan '{plan}'")
    return price_id


def _plan_for_price_id(price_id: str) -> str | None:
    mapping = {
        settings.stripe_starter_price_id: "starter",
        settings.stripe_growth_price_id: "growth",
        settings.stripe_business_price_id: "business",
    }
    return mapping.get(price_id)


def get_or_create_customer(stripe, user: User, db: Session) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(email=user.email, name=user.name, metadata={"user_id": str(user.id)})
    user.stripe_customer_id = customer.id
    db.commit()
    return customer.id


def create_checkout_session(user: User, plan: str, success_url: str, cancel_url: str, db: Session) -> str:
    stripe = _client()
    customer_id = get_or_create_customer(stripe, user, db)
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": _price_id_for_plan(plan), "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": str(user.id), "plan": plan},
    )
    return session.url


def create_portal_session(user: User, return_url: str, db: Session) -> str:
    stripe = _client()
    customer_id = get_or_create_customer(stripe, user, db)
    session = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
    return session.url


def _apply_plan_to_user(user: User, plan: str, db: Session) -> None:
    user.plan = plan
    user.reports_limit = PLAN_LIMITS[plan]["reports_limit"]
    user.reports_used = 0
    db.commit()


def handle_webhook_event(event: dict, db: Session) -> None:
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data, db)
    elif event_type in ("customer.subscription.updated", "customer.subscription.created"):
        _handle_subscription_change(data, db)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data, db)
    else:
        logger.info("Unhandled Stripe webhook event type: %s", event_type)


def _user_by_customer_id(customer_id: str, db: Session) -> User | None:
    return db.query(User).filter(User.stripe_customer_id == customer_id).first()


def _handle_checkout_completed(session: dict, db: Session) -> None:
    user_id = (session.get("metadata") or {}).get("user_id")
    user = db.query(User).filter(User.id == user_id).first() if user_id else None
    if user is None:
        user = _user_by_customer_id(session.get("customer"), db)
    if user is None:
        logger.warning("checkout.session.completed for unknown user (customer=%s)", session.get("customer"))
        return

    user.stripe_sub_id = session.get("subscription")
    plan = (session.get("metadata") or {}).get("plan")
    if plan in PLAN_LIMITS:
        _apply_plan_to_user(user, plan, db)
    else:
        db.commit()


def _handle_subscription_change(subscription: dict, db: Session) -> None:
    user = _user_by_customer_id(subscription.get("customer"), db)
    if user is None:
        return

    items = subscription.get("items", {}).get("data", [])
    price_id = items[0]["price"]["id"] if items else None
    plan = _plan_for_price_id(price_id) if price_id else None
    if plan:
        user.stripe_sub_id = subscription.get("id")
        _apply_plan_to_user(user, plan, db)


def _handle_subscription_deleted(subscription: dict, db: Session) -> None:
    user = _user_by_customer_id(subscription.get("customer"), db)
    if user is None:
        return
    user.stripe_sub_id = None
    _apply_plan_to_user(user, "free", db)


def report_overage_usage(user: User) -> None:
    """Records one unit of metered overage usage on the user's subscription
    once they've exceeded their plan's included report count. No-op if
    Stripe isn't configured or the plan has no overage pricing."""
    if PLAN_LIMITS.get(user.plan, {}).get("overage_cents") is None:
        return
    if not user.stripe_sub_id:
        return

    try:
        stripe = _client()
        stripe.billing.MeterEvent.create(
            event_name="report_overage",
            payload={"stripe_customer_id": user.stripe_customer_id, "value": "1"},
        )
    except StripeNotConfiguredError:
        logger.info("Stripe not configured; skipping overage usage report for user %s", user.id)
    except Exception:
        logger.exception("Failed to report overage usage for user %s", user.id)
