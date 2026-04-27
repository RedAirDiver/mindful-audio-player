import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Admin notification function (formerly customer receipt).
// Customer receipts are now handled by Stripe directly via payment_intent.receipt_email.
// This function sends a simple internal notification to info@unestal.se for every PAID purchase.

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
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) throw new Error("BREVO_API_KEY is not set");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { user_id, program_id, amount_paid, purchase_date } = await req.json();

    if (!user_id || !program_id) {
      return new Response(JSON.stringify({ error: "user_id och program_id krävs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paid = Number(amount_paid ?? 0);

    // Skip free purchases (manual assignments / category access) — only notify for real Stripe payments
    if (paid <= 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Gratisköp – ingen notifiering" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("name, email, company")
      .eq("user_id", user_id)
      .maybeSingle();

    // Fetch program
    const { data: program } = await adminClient
      .from("programs")
      .select("title")
      .eq("id", program_id)
      .maybeSingle();

    if (!program) {
      return new Response(JSON.stringify({ error: "Program hittades inte" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const date = purchase_date ? new Date(purchase_date) : new Date();
    const formattedDate = date.toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const customerName = profile?.name || "Okänd kund";
    const customerEmail = profile?.email || "(saknar e-post)";
    const company = profile?.company ? `<p><strong>Företag:</strong> ${profile.company}</p>` : "";

    const notificationHtml = `
<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#1f3550;padding:20px;">
  <h2 style="color:#2b5a8c;margin:0 0 16px;">Nytt köp på mentalträning.nu</h2>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
    <tr><td><strong>Datum:</strong></td><td>${formattedDate}</td></tr>
    <tr><td><strong>Kund:</strong></td><td>${customerName}</td></tr>
    <tr><td><strong>E-post:</strong></td><td>${customerEmail}</td></tr>
    ${profile?.company ? `<tr><td><strong>Företag:</strong></td><td>${profile.company}</td></tr>` : ""}
    <tr><td><strong>Program:</strong></td><td>${program.title}</td></tr>
    <tr><td><strong>Belopp:</strong></td><td>${paid.toFixed(2)} kr (inkl. moms)</td></tr>
  </table>
  <p style="font-size:12px;color:#718096;margin-top:24px;">
    Stripe har automatiskt skickat ett kvitto till kunden. Detta är en intern notifiering.
  </p>
</body>
</html>`;

    // Send internal notification to info@unestal.se via Brevo
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
        subject: `Nytt köp: ${program.title} – ${paid.toFixed(2)} kr`,
        htmlContent: notificationHtml,
      }),
    });

    if (!brevoResponse.ok) {
      const errBody = await brevoResponse.text();
      console.error("Brevo error:", brevoResponse.status, errBody);
      throw new Error(`Brevo API error: ${brevoResponse.status}`);
    }

    const result = await brevoResponse.json();
    console.log("Admin notification sent for purchase:", program.title, paid, "kr — messageId:", result.messageId);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel";
    console.error("send-receipt error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
