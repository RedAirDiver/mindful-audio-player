import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Inloggning krävs");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Kunde inte verifiera inloggning");

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id krävs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.status !== "complete" || session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ error: "Betalningen är inte genomförd", status: session.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = session.metadata?.user_id;
    const programId = session.metadata?.program_id;
    const discountCode = session.metadata?.discount_code;
    const referralCode = session.metadata?.referral_code;
    const amountPaid = parseFloat(session.metadata?.amount_paid || "0");

    if (!userId || !programId) {
      return new Response(JSON.stringify({ error: "Metadata saknas i sessionen" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user making the request matches the session
    if (userId !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Obehörig" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if purchase already exists (idempotency)
    const { data: existingPurchase } = await adminClient
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("program_id", programId)
      .maybeSingle();

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ success: true, message: "Köpet är redan registrerat" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create purchase
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

    // Send receipt email (fire-and-forget)
    try {
      const receiptUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-receipt`;
      await fetch(receiptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_id: userId,
          program_id: programId,
          amount_paid: amountPaid,
        }),
      });
    } catch (e) {
      console.error("Failed to send receipt:", e);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Köp genomfört!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel";
    console.error("verify-payment error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
