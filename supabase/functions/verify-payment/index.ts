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

    // Send customer receipt + admin notification inline via Brevo (don't rely on Stripe's
    // Dashboard "successful payment emails" setting which may be disabled).
    try {
      const brevoKey = Deno.env.get("BREVO_API_KEY");
      if (!brevoKey) {
        console.error("BREVO_API_KEY not set – skipping receipts");
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

        const customerName = profile?.name || "Kund";
        // Prefer the email Stripe charged (always present), fall back to profile/user
        const customerEmail =
          session.customer_details?.email ||
          (session as any).customer_email ||
          profile?.email ||
          userData.user.email ||
          "";
        const programTitle = program?.title || programId;
        const vatAmount = (amountPaid - amountPaid / 1.25);
        const netAmount = amountPaid / 1.25;

        // ---- Customer receipt ----
        const customerHtml = `
<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f3550;padding:24px;background:#f7fafc;">
  <div style="max-width:560px;margin:auto;background:#fff;padding:32px;border-radius:8px;">
    <h2 style="color:#2b5a8c;margin:0 0 16px;">Tack för ditt köp!</h2>
    <p>Hej ${customerName},</p>
    <p>Vi bekräftar att vi har tagit emot din betalning. Programmet finns nu tillgängligt på <a href="https://xn--mentaltrning-ncb.nu/mina-program">Mina program</a>.</p>
    <h3 style="color:#2b5a8c;margin-top:24px;">Kvitto</h3>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
      <tr><td><strong>Datum:</strong></td><td>${formattedDate}</td></tr>
      <tr><td><strong>Program:</strong></td><td>${programTitle}</td></tr>
      <tr><td><strong>Belopp exkl. moms:</strong></td><td>${netAmount.toFixed(2)} kr</td></tr>
      <tr><td><strong>Moms (25%):</strong></td><td>${vatAmount.toFixed(2)} kr</td></tr>
      <tr><td><strong>Totalt betalt:</strong></td><td><strong>${amountPaid.toFixed(2)} kr</strong></td></tr>
    </table>
    <p style="margin-top:24px;font-size:13px;color:#4a5568;">
      Säljare: Unestål Education AB<br>
      Har du frågor? Kontakta oss via <a href="https://xn--mentaltrning-ncb.nu/om-oss">kontaktformuläret</a>.
    </p>
  </div>
</body></html>`;

        if (customerEmail) {
          const custRes = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              sender: { name: "Mental Träning", email: "noreply@xn--mentaltrning-ncb.nu" },
              to: [{ email: customerEmail, name: customerName }],
              bcc: [{ email: "info@unestal.se", name: "Unestål Education" }],
              replyTo: { email: "info@unestal.se", name: "Unestål Education" },
              subject: `Kvitto – ${programTitle}`,
              htmlContent: customerHtml,
            }),
          });
          if (!custRes.ok) {
            console.error("Brevo customer receipt error:", custRes.status, await custRes.text());
          } else {
            const r = await custRes.json();
            console.log("Customer receipt sent to", customerEmail, "messageId:", r.messageId);
          }
        } else {
          console.warn("No customer email found – skipping customer receipt");
        }

        // ---- Admin notification (separate, in case BCC is filtered) ----
        const adminHtml = `
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
</body></html>`;

        const adminRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sender: { name: "Mental Träning – Notifiering", email: "noreply@xn--mentaltrning-ncb.nu" },
            to: [{ email: "info@unestal.se", name: "Unestål Education" }],
            subject: `Nytt köp: ${programTitle} – ${amountPaid.toFixed(2)} kr`,
            htmlContent: adminHtml,
          }),
        });
        if (!adminRes.ok) {
          console.error("Brevo admin error:", adminRes.status, await adminRes.text());
        } else {
          const r = await adminRes.json();
          console.log("Admin notification sent — messageId:", r.messageId);
        }
      }
    } catch (e) {
      console.error("Failed to send receipts:", e);
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
