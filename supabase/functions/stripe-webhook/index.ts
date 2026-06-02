import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Public endpoint — Stripe calls this server-to-server.
// No CORS needed (not called from browser), but we accept POST only.

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) return new Response("STRIPE_SECRET_KEY not set", { status: 500 });
  if (!webhookSecret) return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

  try {
    // Both events fire for async payment methods (Klarna/Swish/etc):
    // - checkout.session.completed: session done (may not yet be paid for async methods)
    // - checkout.session.async_payment_succeeded: async payment confirmed
    // We handle both — fulfillPurchase is idempotent.
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only fulfill if actually paid
      if (session.payment_status !== "paid") {
        console.log(`[stripe-webhook] Session ${session.id} not paid yet (status=${session.payment_status}), skipping`);
        return new Response(JSON.stringify({ received: true, skipped: "not_paid" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      await fulfillPurchase(stripe, adminClient, session);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] Handler error:", msg);
    // Return 500 so Stripe retries
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function fulfillPurchase(
  stripe: Stripe,
  adminClient: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.user_id;
  const programId = session.metadata?.program_id;
  const discountCode = session.metadata?.discount_code;
  const referralCode = session.metadata?.referral_code;
  const amountPaid = session.amount_total
    ? session.amount_total / 100
    : parseFloat(session.metadata?.amount_paid || "0");

  if (!userId || !programId) {
    console.warn(`[stripe-webhook] Session ${session.id} missing metadata (user_id/program_id), skipping`);
    return;
  }

  // Idempotency — check if purchase already exists
  const { data: existing } = await adminClient
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  if (existing) {
    console.log(`[stripe-webhook] Purchase already exists for user=${userId} program=${programId}, skipping`);
    return;
  }

  const { data: purchaseRow, error: purchaseError } = await adminClient
    .from("purchases")
    .insert({
      user_id: userId,
      program_id: programId,
      amount_paid: amountPaid,
    })
    .select("id")
    .single();

  if (purchaseError) throw purchaseError;
  console.log(`[stripe-webhook] Created purchase ${purchaseRow.id} for user=${userId} program=${programId}`);

  // Increment discount code usage
  if (discountCode) {
    const { data: dc } = await adminClient
      .from("discount_codes")
      .select("id, times_used")
      .eq("code", discountCode.toUpperCase().trim())
      .maybeSingle();
    if (dc) {
      await adminClient
        .from("discount_codes")
        .update({ times_used: dc.times_used + 1 })
        .eq("id", dc.id);
    }
  }

  // Handle affiliate commission
  if (referralCode && purchaseRow) {
    const { data: program } = await adminClient
      .from("programs")
      .select("price")
      .eq("id", programId)
      .maybeSingle();

    const { data: affiliate } = await adminClient
      .from("affiliates")
      .select("id, commission_rate")
      .eq("referral_code", referralCode)
      .eq("status", "approved")
      .maybeSingle();

    if (affiliate && program) {
      const commissionAmount = (program.price * affiliate.commission_rate) / 100;
      await adminClient.from("commissions").insert({
        affiliate_id: affiliate.id,
        purchase_id: purchaseRow.id,
        amount: commissionAmount,
      });

      await adminClient
        .from("referrals")
        .update({ converted: true, converted_user_id: userId })
        .eq("affiliate_id", affiliate.id)
        .eq("converted", false);
    }
  }
}
