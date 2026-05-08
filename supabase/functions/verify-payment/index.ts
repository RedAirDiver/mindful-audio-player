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
    // Use Stripe's actual charged amount (in öre), fall back to metadata
    const amountPaid = session.amount_total
      ? session.amount_total / 100
      : parseFloat(session.metadata?.amount_paid || "0");

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

    // Send admin notification inline (don't rely on cross-function fetch which can die before completing)
    try {
      const brevoKey = Deno.env.get("BREVO_API_KEY");
      if (!brevoKey) {
        console.error("BREVO_API_KEY not set – skipping admin notification");
      } else if (amountPaid > 0) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("name, email, company")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: program } = await adminClient
          .from("programs")
          .select("title")
          .eq("id", programId)
          .maybeSingle();

        const formattedDate = new Date().toLocaleString("sv-SE", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        });

        const customerName = profile?.name || "Okänd kund";
        const customerEmail = profile?.email || "(saknar e-post)";
        const programTitle = program?.title || programId;

        const html = `
<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f3550;padding:20px;">
  <h2 style="color:#2b5a8c;margin:0 0 16px;">Nytt köp på mentalträning.nu</h2>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
    <tr><td><strong>Datum:</strong></td><td>${formattedDate}</td></tr>
    <tr><td><strong>Kund:</strong></td><td>${customerName}</td></tr>
    <tr><td><strong>E-post:</strong></td><td>${customerEmail}</td></tr>
    ${profile?.company ? `<tr><td><strong>Företag:</strong></td><td>${profile.company}</td></tr>` : ""}
    <tr><td><strong>Program:</strong></td><td>${programTitle}</td></tr>
    <tr><td><strong>Belopp:</strong></td><td>${amountPaid.toFixed(2)} kr (inkl. moms)</td></tr>
  </table>
  <p style="font-size:12px;color:#718096;margin-top:24px;">
    Stripe har automatiskt skickat ett kvitto till kunden. Detta är en intern notifiering.
  </p>
</body></html>`;

        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: "Mental Träning – Notifiering", email: "noreply@xn--mentaltrning-ncb.nu" },
            to: [{ email: "info@unestal.se", name: "Unestål Education" }],
            subject: `Nytt köp: ${programTitle} – ${amountPaid.toFixed(2)} kr`,
            htmlContent: html,
          }),
        });

        if (!brevoResponse.ok) {
          const errBody = await brevoResponse.text();
          console.error("Brevo error:", brevoResponse.status, errBody);
        } else {
          const result = await brevoResponse.json();
          console.log("Admin notification sent:", programTitle, amountPaid, "kr — messageId:", result.messageId);
        }
      }
    } catch (e) {
      console.error("Failed to send admin notification:", e);
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
