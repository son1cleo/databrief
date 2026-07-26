import "server-only";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";

// plan -> (included reports per period, overage price in cents)
const PLAN_LIMITS: Record<string, { reportsLimit: number; overageCents: number | null }> = {
  free: { reportsLimit: 3, overageCents: null },
  starter: { reportsLimit: 20, overageCents: 300 },
  growth: { reportsLimit: 100, overageCents: 200 },
  business: { reportsLimit: 1_000_000_000, overageCents: null }, // effectively unlimited
};

export class StripeNotConfiguredError extends Error {}

function client(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new StripeNotConfiguredError("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function priceIdForPlan(plan: string): string {
  const mapping: Record<string, string | undefined> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    growth: process.env.STRIPE_GROWTH_PRICE_ID,
    business: process.env.STRIPE_BUSINESS_PRICE_ID,
  };
  const priceId = mapping[plan];
  if (!priceId) throw new Error(`No Stripe price configured for plan '${plan}'`);
  return priceId;
}

function planForPriceId(priceId: string): string | null {
  const mapping: Record<string, string> = {
    [process.env.STRIPE_STARTER_PRICE_ID ?? ""]: "starter",
    [process.env.STRIPE_GROWTH_PRICE_ID ?? ""]: "growth",
    [process.env.STRIPE_BUSINESS_PRICE_ID ?? ""]: "business",
  };
  return mapping[priceId] ?? null;
}

async function getOrCreateCustomer(stripe: Stripe, user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { user_id: user.id },
  });
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(
  user: User,
  plan: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = client();
  const customerId = await getOrCreateCustomer(stripe, user);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { user_id: user.id, plan },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(user: User, returnUrl: string): Promise<string> {
  const stripe = client();
  const customerId = await getOrCreateCustomer(stripe, user);
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

export function getUsage(user: User) {
  return {
    plan: user.plan,
    reports_used: user.reportsUsed,
    reports_limit: user.reportsLimit,
    reports_remaining: Math.max(user.reportsLimit - user.reportsUsed, 0),
    overage_cents: PLAN_LIMITS[user.plan]?.overageCents ?? null,
  };
}

async function applyPlanToUser(userId: string, plan: string): Promise<void> {
  const limits = PLAN_LIMITS[plan];
  await prisma.user.update({
    where: { id: userId },
    data: { plan, reportsLimit: limits.reportsLimit, reportsUsed: 0 },
  });
}

async function userByCustomerId(customerId: string | null): Promise<User | null> {
  if (!customerId) return null;
  return prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id;
  let user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user) {
    const customerId = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
    user = await userByCustomerId(customerId);
  }
  if (!user) {
    console.warn(`checkout.session.completed for unknown user (customer=${String(session.customer)})`);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
  await prisma.user.update({ where: { id: user.id }, data: { stripeSubId: subscriptionId } });

  const plan = session.metadata?.plan;
  if (plan && plan in PLAN_LIMITS) {
    await applyPlanToUser(user.id, plan);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const user = await userByCustomerId(customerId);
  if (!user) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? planForPriceId(priceId) : null;
  if (plan) {
    await prisma.user.update({ where: { id: user.id }, data: { stripeSubId: subscription.id } });
    await applyPlanToUser(user.id, plan);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const user = await userByCustomerId(customerId);
  if (!user) return;
  await prisma.user.update({ where: { id: user.id }, data: { stripeSubId: null } });
  await applyPlanToUser(user.id, "free");
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.created":
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      console.info(`Unhandled Stripe webhook event type: ${event.type}`);
  }
}

/** Records one unit of metered overage usage once a user exceeds their
 * plan's included report count. No-op if Stripe isn't configured or the
 * plan has no overage pricing. */
export async function reportOverageUsage(user: User): Promise<void> {
  if (PLAN_LIMITS[user.plan]?.overageCents == null) return;
  if (!user.stripeSubId) return;

  try {
    const stripe = client();
    await stripe.billing.meterEvents.create({
      event_name: "report_overage",
      payload: { stripe_customer_id: user.stripeCustomerId ?? "", value: "1" },
    });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      console.info(`Stripe not configured; skipping overage usage report for user ${user.id}`);
      return;
    }
    console.error(`Failed to report overage usage for user ${user.id}:`, err);
  }
}
