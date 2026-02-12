import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedNames = possibleNames.map(normalizeHeader);

  for (const name of normalizedNames) {
    const idx = normalizedHeaders.indexOf(name);
    if (idx !== -1) return idx;
  }
  for (const name of normalizedNames) {
    const idx = normalizedHeaders.findIndex((h) => h.startsWith(name));
    if (idx !== -1) return idx;
  }
  for (const name of normalizedNames) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function generateSlug(title: string): string {
  let slug = title.toLowerCase();
  slug = slug.replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o");
  slug = slug.replace(/[^a-z0-9]+/g, "-");
  slug = slug.replace(/^-|-$/g, "");
  return slug;
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { csvContent, dryRun } = await req.json();

    if (!csvContent || typeof csvContent !== "string") {
      return new Response(
        JSON.stringify({ error: "CSV content required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse CSV
    const lines = csvContent.split(/\r?\n/).filter((l: string) => l.trim());
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have header + at least 1 row" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const headers = parseCSVLine(lines[0]);
    console.log("CSV headers:", headers);

    // Find columns
    const idCol = findColumnIndex(headers, ["ID", "id", "product_id", "wc_id"]);
    const nameCol = findColumnIndex(headers, ["Name", "name", "title", "post_title", "product_name"]);
    const descCol = findColumnIndex(headers, ["Description", "description", "post_content"]);
    const shortDescCol = findColumnIndex(headers, ["Short description", "short_description", "post_excerpt"]);
    const priceCol = findColumnIndex(headers, ["Regular price", "regular_price", "price", "Price"]);
    const salePriceCol = findColumnIndex(headers, ["Sale price", "sale_price"]);
    const skuCol = findColumnIndex(headers, ["SKU", "sku"]);
    const catCol = findColumnIndex(headers, ["Categories", "categories", "category"]);
    const imageCol = findColumnIndex(headers, ["Images", "images", "image", "image_url"]);
    const publishedCol = findColumnIndex(headers, ["Published", "published", "status", "post_status"]);
    const typeCol = findColumnIndex(headers, ["Type", "type", "product_type"]);

    console.log("Column mapping:", { idCol, nameCol, descCol, shortDescCol, priceCol, skuCol, catCol, imageCol, publishedCol, typeCol });

    if (nameCol === -1) {
      return new Response(
        JSON.stringify({ error: "Could not find product name column in CSV" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get existing programs for dedup
    const existingPrograms = new Map<number, string>();
    const existingSlugs = new Set<string>();
    let offset = 0;
    while (true) {
      const { data: page } = await adminClient
        .from("programs")
        .select("id, wc_id, slug")
        .range(offset, offset + 999);
      if (!page || page.length === 0) break;
      for (const p of page) {
        if (p.wc_id) existingPrograms.set(p.wc_id, p.id);
        existingSlugs.add(p.slug);
      }
      if (page.length < 1000) break;
      offset += 1000;
    }

    const results = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; name: string; error: string }[],
    };

    // Process rows
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const name = nameCol !== -1 ? cols[nameCol] : "";
      if (!name || !name.trim()) continue;

      results.total++;

      // Skip variable/variation products
      const productType = typeCol !== -1 ? cols[typeCol]?.toLowerCase() : "";
      if (productType === "variable" || productType === "variation") {
        results.skipped++;
        continue;
      }

      const wcId = idCol !== -1 ? parseInt(cols[idCol]) : null;
      const description = descCol !== -1 ? cols[descCol] || "" : "";
      const shortDescription = shortDescCol !== -1 ? cols[shortDescCol] || "" : "";
      
      let price = 0;
      if (priceCol !== -1 && cols[priceCol]) {
        price = parseFloat(cols[priceCol].replace(",", ".")) || 0;
      }
      if (salePriceCol !== -1 && cols[salePriceCol] && parseFloat(cols[salePriceCol])) {
        price = parseFloat(cols[salePriceCol].replace(",", "."));
      }

      const sku = skuCol !== -1 ? cols[skuCol] || null : null;
      
      // Parse categories: "Cat1, Cat2" or "Cat1 > SubCat"
      let categories: string[] = [];
      if (catCol !== -1 && cols[catCol]) {
        categories = cols[catCol]
          .split(",")
          .map((c: string) => {
            // Take last part if hierarchical (e.g. "Parent > Child")
            const parts = c.split(">");
            return parts[parts.length - 1].trim();
          })
          .filter((c: string) => c);
      }

      const imageUrl = imageCol !== -1 ? (cols[imageCol]?.split(",")[0]?.trim() || null) : null;

      let isActive = true;
      if (publishedCol !== -1 && cols[publishedCol]) {
        const val = cols[publishedCol].toLowerCase().trim();
        isActive = val === "1" || val === "true" || val === "yes" || val === "publish";
      }

      // Generate unique slug
      let baseSlug = generateSlug(name);
      let slug = baseSlug;
      let slugCounter = 1;
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${slugCounter}`;
        slugCounter++;
      }

      if (dryRun) {
        if (wcId && existingPrograms.has(wcId)) {
          results.updated++;
        } else {
          results.created++;
        }
        continue;
      }

      try {
        if (wcId && existingPrograms.has(wcId)) {
          // Update existing
          const { error } = await adminClient
            .from("programs")
            .update({
              title: name.trim(),
              description: description || null,
              short_description: shortDescription || null,
              price,
              sku: sku || null,
              categories: categories.length > 0 ? categories : null,
              image_url: imageUrl,
              is_active: isActive,
            })
            .eq("id", existingPrograms.get(wcId)!);

          if (error) {
            results.errors.push({ row: i + 1, name, error: error.message });
          } else {
            results.updated++;
          }
        } else {
          // Insert new
          const { error } = await adminClient.from("programs").insert({
            title: name.trim(),
            slug,
            description: description || null,
            short_description: shortDescription || null,
            price,
            wc_id: wcId || null,
            sku: sku || null,
            categories: categories.length > 0 ? categories : null,
            image_url: imageUrl,
            is_active: isActive,
          });

          if (error) {
            results.errors.push({ row: i + 1, name, error: error.message });
          } else {
            results.created++;
            existingSlugs.add(slug);
            if (wcId) existingPrograms.set(wcId, "new");
          }
        }
      } catch (err) {
        results.errors.push({
          row: i + 1,
          name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(JSON.stringify({ dryRun: !!dryRun, results }), {
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
