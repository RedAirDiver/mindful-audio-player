import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WpUser {
  wp_id: number;
  email: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  password_hash: string;
  registered: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for user creation
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { users, dryRun } = (await req.json()) as {
      users: WpUser[];
      dryRun?: boolean;
    };

    if (!users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: users array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for existing emails to avoid duplicates
    const emails = users.map((u) => u.email.toLowerCase());
    const { data: existingProfiles } = await adminClient
      .from("profiles")
      .select("email, wp_user_id")
      .or(emails.map((e) => `email.eq.${e}`).join(","));

    const existingEmails = new Set(
      (existingProfiles || []).map((p) => p.email?.toLowerCase())
    );

    const results = {
      total: users.length,
      skipped: 0,
      imported: 0,
      errors: [] as { email: string; error: string }[],
      skippedEmails: [] as string[],
    };

    if (dryRun) {
      // Just return what would happen
      for (const wpUser of users) {
        if (existingEmails.has(wpUser.email.toLowerCase())) {
          results.skipped++;
          results.skippedEmails.push(wpUser.email);
        } else {
          results.imported++;
        }
      }
      return new Response(JSON.stringify({ dryRun: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process users in batches
    for (const wpUser of users) {
      const email = wpUser.email.toLowerCase().trim();

      if (existingEmails.has(email)) {
        results.skipped++;
        results.skippedEmails.push(email);
        continue;
      }

      try {
        // Generate a random password - users will use legacy hash login or reset
        const randomPassword = crypto.randomUUID() + "Aa1!";

        // Create auth user
        const { data: authData, error: authError } =
          await adminClient.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true,
            user_metadata: {
              name: wpUser.display_name,
              wp_user_id: wpUser.wp_id,
            },
          });

        if (authError) {
          results.errors.push({ email, error: authError.message });
          continue;
        }

        if (authData.user) {
          // Update profile with WP data (profile is auto-created by trigger)
          const name =
            wpUser.first_name && wpUser.last_name
              ? `${wpUser.first_name} ${wpUser.last_name}`.trim()
              : wpUser.display_name;

          const { error: profileError } = await adminClient
            .from("profiles")
            .update({
              name,
              wp_user_id: wpUser.wp_id,
              legacy_password_hash: wpUser.password_hash || null,
            })
            .eq("user_id", authData.user.id);

          if (profileError) {
            results.errors.push({
              email,
              error: `User created but profile update failed: ${profileError.message}`,
            });
          }
        }

        results.imported++;
        existingEmails.add(email); // Prevent duplicates within same batch
      } catch (err) {
        results.errors.push({
          email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
