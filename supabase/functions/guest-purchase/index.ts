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
    const { email, name, program_id } = body;

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
    if (!userId) {
      // Check existing user by email
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user with random password
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

        // Update profile name if provided
        if (name) {
          await adminClient
            .from("profiles")
            .update({ name })
            .eq("user_id", userId);
        }

        // Send password reset email so user can set their own password
        // We use the admin API to generate the recovery link
        const { data: recoveryData, error: recoveryError } = 
          await adminClient.auth.admin.generateLink({
            type: "recovery",
            email,
            options: {
              redirectTo: `${req.headers.get("origin") || supabaseUrl}/reset-password`,
            },
          });

        if (recoveryError) {
          console.error("Could not send recovery email:", recoveryError);
        }
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

    // Create purchase
    const { error: purchaseError } = await adminClient
      .from("purchases")
      .insert({
        user_id: userId,
        program_id: program_id,
        amount_paid: program.price,
      });

    if (purchaseError) {
      return new Response(
        JSON.stringify({ error: purchaseError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_created: !authHeader,
        message: !authHeader
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
