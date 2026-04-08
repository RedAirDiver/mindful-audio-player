import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    // Fetch user profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("name, email, company, address_line1, address_city, address_postcode, address_country")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "Användarprofil saknas" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch program
    const { data: program } = await adminClient
      .from("programs")
      .select("title, price")
      .eq("id", program_id)
      .maybeSingle();

    if (!program) {
      return new Response(JSON.stringify({ error: "Program hittades inte" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paid = amount_paid ?? 0;
    const date = purchase_date ? new Date(purchase_date) : new Date();
    const formattedDate = date.toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Calculate VAT (25% Swedish VAT, included in price)
    const vatRate = 25;
    const totalInclVat = paid;
    const vatAmount = Math.round((totalInclVat * vatRate / (100 + vatRate)) * 100) / 100;
    const totalExclVat = Math.round((totalInclVat - vatAmount) * 100) / 100;

    const customerName = profile.name || "Kund";

    // Build receipt HTML
    const receiptHtml = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kvitto - Mental Träning by Unestål</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header with logo -->
          <tr>
            <td style="background-color:#2b5a8c;padding:28px 40px;text-align:center;">
              <img src="https://jjllqcgywodfnaotnkxe.supabase.co/storage/v1/object/public/product-images/logo%2Flogo.png" alt="Unestål Education" width="200" style="display:block;margin:0 auto 12px;" />
              <p style="color:#c0d4e8;font-size:14px;margin:0;">Kvitto / Faktura</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              
              <!-- Greeting -->
              <p style="font-size:16px;color:#1f3550;margin:0 0 24px;">
                Hej ${customerName},
              </p>
              <p style="font-size:14px;color:#4a5568;margin:0 0 32px;line-height:1.6;">
                Tack för ditt köp! Här är ditt kvitto.
              </p>

              <!-- Invoice details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Datum</td>
                  <td style="font-size:14px;color:#1f3550;text-align:right;padding-bottom:8px;">${formattedDate}</td>
                </tr>
                ${profile.company ? `<tr>
                  <td style="font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Företag</td>
                  <td style="font-size:14px;color:#1f3550;text-align:right;padding-bottom:8px;">${profile.company}</td>
                </tr>` : ""}
                <tr>
                  <td style="font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Kund</td>
                  <td style="font-size:14px;color:#1f3550;text-align:right;padding-bottom:8px;">${customerName}</td>
                </tr>
                ${profile.address_line1 ? `<tr>
                  <td style="font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Adress</td>
                  <td style="font-size:14px;color:#1f3550;text-align:right;padding-bottom:8px;">
                    ${profile.address_line1}${profile.address_postcode ? `, ${profile.address_postcode}` : ""} ${profile.address_city || ""}
                  </td>
                </tr>` : ""}
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">

              <!-- Line items -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr style="background-color:#f7fafc;">
                  <td style="font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px;border-radius:8px 0 0 0;">Produkt</td>
                  <td style="font-size:12px;color:#718096;text-transform:uppercase;letter-spacing:0.5px;padding:12px 16px;text-align:right;border-radius:0 8px 0 0;">Belopp</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#1f3550;padding:16px;">
                    ${program.title}
                  </td>
                  <td style="font-size:14px;color:#1f3550;padding:16px;text-align:right;">
                    ${totalInclVat === 0 ? "Gratis" : `${totalInclVat.toFixed(2)} kr`}
                  </td>
                </tr>
              </table>

              ${totalInclVat > 0 ? `
              <!-- Totals -->
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#718096;padding:6px 16px;">Exkl. moms</td>
                  <td style="font-size:13px;color:#718096;padding:6px 16px;text-align:right;">${totalExclVat.toFixed(2)} kr</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:#718096;padding:6px 16px;">Moms (${vatRate}%)</td>
                  <td style="font-size:13px;color:#718096;padding:6px 16px;text-align:right;">${vatAmount.toFixed(2)} kr</td>
                </tr>
                <tr>
                  <td style="font-size:16px;font-weight:700;color:#1f3550;padding:12px 16px;border-top:2px solid #2b5a8c;">Totalt</td>
                  <td style="font-size:16px;font-weight:700;color:#1f3550;padding:12px 16px;text-align:right;border-top:2px solid #2b5a8c;">${totalInclVat.toFixed(2)} kr</td>
                </tr>
              </table>
              ` : ""}

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td align="center">
                    <a href="https://xn--mentaltrning-ncb.nu/mina-program" style="display:inline-block;background-color:#2b5a8c;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;">
                      Gå till mina program
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f7fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="font-size:12px;color:#718096;margin:0 0 4px;font-weight:600;">
                Unestål Education
              </p>
              <p style="font-size:12px;color:#a0aec0;margin:0 0 2px;">
                Hagalundsvägen 4, SE-702 30 Örebro
              </p>
              <p style="font-size:12px;color:#a0aec0;margin:0 0 8px;">
                <a href="https://xn--mentaltrning-ncb.nu" style="color:#2b5a8c;text-decoration:none;">mentalträning.nu</a>
              </p>
              <p style="font-size:11px;color:#cbd5e0;margin:0;">
                Detta kvitto skickades automatiskt efter genomfört köp.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Brevo API
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Mental Träning by Unestål", email: "noreply@xn--mentaltrning-ncb.nu" },
        to: [{ email: profile.email, name: customerName }],
        subject: `Kvitto – ${program.title}`,
        htmlContent: receiptHtml,
      }),
    });

    if (!brevoResponse.ok) {
      const errBody = await brevoResponse.text();
      console.error("Brevo error:", brevoResponse.status, errBody);
      throw new Error(`Brevo API error: ${brevoResponse.status}`);
    }

    const result = await brevoResponse.json();
    console.log("Receipt sent to", profile.email, "messageId:", result.messageId);

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
