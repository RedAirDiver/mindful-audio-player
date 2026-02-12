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
  phone?: string;
  company?: string;
  address_line1?: string;
  address_city?: string;
  address_postcode?: string;
  address_country?: string;
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

    // Build map of existing emails -> profile data for update detection
    const existingProfileMap = new Map<string, { user_id: string; wp_user_id: number | null }>();
    let offset = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data: page, error: pageError } = await adminClient
        .from("profiles")
        .select("email, user_id, wp_user_id")
        .range(offset, offset + PAGE_SIZE - 1);

      if (pageError || !page || page.length === 0) break;
      for (const p of page) {
        if (p.email) existingProfileMap.set(p.email.toLowerCase(), { user_id: p.user_id, wp_user_id: p.wp_user_id });
      }
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const results = {
      total: users.length,
      skipped: 0,
      updated: 0,
      imported: 0,
      errors: [] as { email: string; error: string }[],
      skippedEmails: [] as string[],
    };

    if (dryRun) {
      for (const wpUser of users) {
        if (existingProfileMap.has(wpUser.email.toLowerCase())) {
          results.updated++;
        } else {
          results.imported++;
        }
      }
      return new Response(JSON.stringify({ dryRun: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process users
    for (const wpUser of users) {
      const email = wpUser.email.toLowerCase().trim();
      const existing = existingProfileMap.get(email);

      const name =
        wpUser.first_name && wpUser.last_name
          ? `${wpUser.first_name} ${wpUser.last_name}`.trim()
          : wpUser.display_name;

      if (existing) {
        // Update existing profile with WP data
        try {
          const { error: updateError } = await adminClient
            .from("profiles")
            .update({
              name,
              wp_user_id: wpUser.wp_id,
              legacy_password_hash: wpUser.password_hash || null,
              phone: wpUser.phone || null,
              company: wpUser.company || null,
              address_line1: wpUser.address_line1 || null,
              address_city: wpUser.address_city || null,
              address_postcode: wpUser.address_postcode || null,
              address_country: wpUser.address_country || null,
            })
            .eq("user_id", existing.user_id);

          if (updateError) {
            results.errors.push({ email, error: `Update failed: ${updateError.message}` });
          } else {
            results.updated++;
          }
        } catch (err) {
          results.errors.push({ email, error: err instanceof Error ? err.message : String(err) });
        }
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
          const { error: profileError } = await adminClient
            .from("profiles")
            .update({
              name,
              wp_user_id: wpUser.wp_id,
              legacy_password_hash: wpUser.password_hash || null,
              phone: wpUser.phone || null,
              company: wpUser.company || null,
              address_line1: wpUser.address_line1 || null,
              address_city: wpUser.address_city || null,
              address_postcode: wpUser.address_postcode || null,
              address_country: wpUser.address_country || null,
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
        existingProfileMap.set(email, { user_id: authData.user?.id || "", wp_user_id: wpUser.wp_id });
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
