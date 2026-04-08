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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Inloggning krävs");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Kunde inte verifiera inloggning");

    const user = userData.user;

    const body = await req.json();
    const { program_id, discount_code, referral_code } = body;

    if (!program_id) {
      return new Response(JSON.stringify({ error: "program_id krävs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch program
    const { data: program, error: programError } = await adminClient
      .from("programs")
      .select("id, title, price, image_url")
      .eq("id", program_id)
      .eq("is_active", true)
      .maybeSingle();

    if (programError || !program) {
      return new Response(JSON.stringify({ error: "Programmet hittades inte" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already purchased
    const { data: existingPurchase } = await adminClient
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("program_id", program_id)
      .maybeSingle();

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ error: "Du har redan köpt detta program", already_purchased: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate price with discount
    let finalPrice = program.price;
    let discountDescription = "";

    if (discount_code) {
      const { data: dc } = await adminClient
        .from("discount_codes")
        .select("*")
        .eq("code", discount_code.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (!dc) {
        return new Response(JSON.stringify({ error: "Ogiltig rabattkod" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (dc.program_ids && dc.program_ids.length > 0 && !dc.program_ids.includes(program_id)) {
        return new Response(
          JSON.stringify({ error: "Rabattkoden gäller inte för detta program" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (dc.usage_limit && dc.times_used >= dc.usage_limit) {
        return new Response(
          JSON.stringify({ error: "Rabattkoden har nått sin användningsgräns" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (dc.discount_type === "percentage") {
        finalPrice = Math.max(0, program.price * (1 - dc.discount_value / 100));
        discountDescription = `${dc.discount_value}% rabatt`;
      } else {
        finalPrice = Math.max(0, program.price - dc.discount_value);
        discountDescription = `${dc.discount_value} kr rabatt`;
      }
    }

    // If free after discount, skip Stripe and create purchase directly
    if (finalPrice <= 0) {
      // Increment discount code usage
      if (discount_code) {
        const { data: dc } = await adminClient
          .from("discount_codes")
          .select("id, times_used")
          .eq("code", discount_code.toUpperCase().trim())
          .maybeSingle();
        if (dc) {
          await adminClient
            .from("discount_codes")
            .update({ times_used: dc.times_used + 1 })
            .eq("id", dc.id);
        }
      }

      await adminClient.from("purchases").insert({
        user_id: user.id,
        program_id,
        amount_paid: 0,
      });

      // Send receipt email for free purchase (fire-and-forget)
      try {
        const receiptUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-receipt`;
        await fetch(receiptUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            program_id,
            amount_paid: 0,
          }),
        });
      } catch (e) {
        console.error("Failed to send receipt:", e);
      }

      return new Response(
        JSON.stringify({ free: true, message: "Gratis! Programmet har lagts till." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Build line item description
    const description = discountDescription
      ? `${program.title} (${discountDescription})`
      : program.title;

    // Create embedded checkout session
    const origin = req.headers.get("origin") || "https://mentaltraning.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: program.title,
              description: discountDescription || undefined,
              images: program.image_url ? [program.image_url] : undefined,
            },
            unit_amount: Math.round(finalPrice * 100), // Convert to öre
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded",
      return_url: `${origin}/kop-bekraftelse?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        user_id: user.id,
        program_id,
        discount_code: discount_code || "",
        referral_code: referral_code || "",
        amount_paid: finalPrice.toString(),
      },
    });

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel";
    console.error("create-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
