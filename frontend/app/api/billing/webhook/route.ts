import { NextResponse } from "next/server";
import Stripe from "stripe";
import { handleWebhookEvent } from "@/lib/billing";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  await handleWebhookEvent(event);
  return NextResponse.json({ received: true });
}
