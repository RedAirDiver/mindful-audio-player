import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MetaUpdate {
  wp_user_id: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  address_line1?: string;
  address_city?: string;
  address_postcode?: string;
  address_country?: string;
  is_paying_customer?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { updates } = (await req.json()) as { updates: MetaUpdate[] };

    if (!updates || !Array.isArray(updates)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: updates array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build map of wp_user_id -> profile user_id
    const wpIds = [...new Set(updates.map((u) => u.wp_user_id))];
    const wpIdToUserId = new Map<number, string>();

    // Fetch in batches of 100 using .in()
    for (let i = 0; i < wpIds.length; i += 100) {
      const batch = wpIds.slice(i, i + 100);
      const { data } = await adminClient
        .from("profiles")
        .select("user_id, wp_user_id")
        .in("wp_user_id", batch);

      if (data) {
        for (const p of data) {
          if (p.wp_user_id) wpIdToUserId.set(p.wp_user_id, p.user_id);
        }
      }
    }

    const results = {
      total: updates.length,
      updated: 0,
      not_found: 0,
      errors: [] as { wp_user_id: number; error: string }[],
    };

    for (const meta of updates) {
      const userId = wpIdToUserId.get(meta.wp_user_id);

      if (!userId) {
        results.not_found++;
        continue;
      }

      try {
        const name =
          meta.first_name && meta.last_name
            ? `${meta.first_name} ${meta.last_name}`.trim()
            : undefined;

        const profileUpdate: Record<string, unknown> = {};
        if (name) profileUpdate.name = name;
        if (meta.phone) profileUpdate.phone = meta.phone;
        if (meta.company) profileUpdate.company = meta.company;
        if (meta.address_line1) profileUpdate.address_line1 = meta.address_line1;
        if (meta.address_city) profileUpdate.address_city = meta.address_city;
        if (meta.address_postcode) profileUpdate.address_postcode = meta.address_postcode;
        if (meta.address_country) profileUpdate.address_country = meta.address_country;

        if (Object.keys(profileUpdate).length === 0) {
          results.not_found++;
          continue;
        }

        const { error } = await adminClient
          .from("profiles")
          .update(profileUpdate)
          .eq("user_id", userId);

        if (error) {
          results.errors.push({
            wp_user_id: meta.wp_user_id,
            error: error.message,
          });
        } else {
          results.updated++;
        }
      } catch (err) {
        results.errors.push({
          wp_user_id: meta.wp_user_id,
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
