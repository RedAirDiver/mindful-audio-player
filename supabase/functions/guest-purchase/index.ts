import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { email, name, program_id, referral_code, discount_code } = body;

    if (!email || !program_id) {
      return new Response(
        JSON.stringify({ error: "Email and program_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the caller is already authenticated
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    // If not authenticated, check if user exists or create one
    let userCreated = false;
    if (!userId) {
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const tempPassword = crypto.randomUUID() + "Aa1!";
        const { data: newUser, error: createError } =
          await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name: name || "" },
          });

        if (createError) {
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newUser.user.id;
        userCreated = true;

        if (name) {
          await adminClient
            .from("profiles")
            .update({ name })
            .eq("user_id", userId);
        }

        await adminClient.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${req.headers.get("origin") || supabaseUrl}/reset-password`,
          },
        });
      }
    }

    // Verify program exists
    const { data: program, error: programError } = await adminClient
      .from("programs")
      .select("id, price, title")
      .eq("id", program_id)
      .eq("is_active", true)
      .maybeSingle();

    if (programError || !program) {
      return new Response(
        JSON.stringify({ error: "Program not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already purchased
    const { data: existingPurchase } = await adminClient
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("program_id", program_id)
      .maybeSingle();

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ error: "Already purchased", already_purchased: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and apply discount code
    let finalPrice = program.price;
    if (discount_code) {
      const { data: dc } = await adminClient
        .from("discount_codes")
        .select("*")
        .eq("code", discount_code.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (!dc) {
        return new Response(
          JSON.stringify({ error: "Ogiltig rabattkod" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check program restriction
      if (dc.program_ids && dc.program_ids.length > 0 && !dc.program_ids.includes(program_id)) {
        return new Response(
          JSON.stringify({ error: "Rabattkoden gäller inte för detta program" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check usage limit
      if (dc.usage_limit && dc.times_used >= dc.usage_limit) {
        return new Response(
          JSON.stringify({ error: "Rabattkoden har nått sin användningsgräns" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Apply discount
      if (dc.discount_type === "percentage") {
        finalPrice = Math.max(0, program.price * (1 - dc.discount_value / 100));
      } else {
        finalPrice = Math.max(0, program.price - dc.discount_value);
      }

      // Increment times_used
      await adminClient
        .from("discount_codes")
        .update({ times_used: dc.times_used + 1 })
        .eq("id", dc.id);
    }

    // Create purchase
    const { data: purchaseRow, error: purchaseError } = await adminClient
      .from("purchases")
      .insert({
        user_id: userId,
        program_id: program_id,
        amount_paid: finalPrice,
      })
      .select("id")
      .single();

    if (purchaseError) {
      return new Response(
        JSON.stringify({ error: purchaseError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle affiliate commission
    if (referral_code && purchaseRow) {
      const { data: affiliate } = await adminClient
        .from("affiliates")
        .select("id, commission_rate")
        .eq("referral_code", referral_code)
        .eq("status", "approved")
        .maybeSingle();

      if (affiliate) {
        const commissionAmount = (program.price * affiliate.commission_rate) / 100;

        await adminClient.from("commissions").insert({
          affiliate_id: affiliate.id,
          purchase_id: purchaseRow.id,
          amount: commissionAmount,
        });

        // Mark referral as converted if exists
        await adminClient
          .from("referrals")
          .update({ converted: true, converted_user_id: userId })
          .eq("affiliate_id", affiliate.id)
          .eq("converted", false);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_created: userCreated,
        message: userCreated
          ? "Konto skapat och köp genomfört. Kolla din e-post för att sätta lösenord."
          : "Köp genomfört!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
