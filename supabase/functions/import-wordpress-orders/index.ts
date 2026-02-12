import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderData {
  orderId: number;
  email: string;
  orderTotal: number;
  orderDate: string;
  status: string;
  productIds: number[]; // WooCommerce product IDs
}

/**
 * Parse serialized PHP arrays to extract product IDs.
 * WooCommerce stores order items as serialized PHP in some meta fields.
 */
function extractProductIdsFromSerialized(value: string): number[] {
  const ids: number[] = [];
  // Match _product_id patterns in serialized PHP
  const productIdRegex = /"_product_id";(?:s:\d+:"|i:)(\d+)/g;
  let match;
  while ((match = productIdRegex.exec(value)) !== null) {
    ids.push(parseInt(match[1], 10));
  }
  // Also try simple product_id patterns
  const simpleRegex = /product_id["\s:]+(\d+)/g;
  while ((match = simpleRegex.exec(value)) !== null) {
    const id = parseInt(match[1], 10);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function parseOrdersFromXml(xmlText: string): OrderData[] {
  const orders: OrderData[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const block = itemMatch[1];

    // Only process shop_order posts
    const postTypeMatch =
      block.match(/<wp:post_type>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:post_type>/);
    if (!postTypeMatch || postTypeMatch[1].trim() !== "shop_order") continue;

    // Extract order ID (wp:post_id)
    const postIdMatch = block.match(/<wp:post_id>(\d+)<\/wp:post_id>/);
    const orderId = postIdMatch ? parseInt(postIdMatch[1], 10) : 0;

    // Extract order date
    const dateMatch =
      block.match(/<wp:post_date>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:post_date>/);
    const orderDate = dateMatch ? dateMatch[1].trim() : "";

    // Extract order status
    const statusMatch =
      block.match(/<wp:status>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:status>/);
    const status = statusMatch ? statusMatch[1].trim() : "";

    // Parse postmeta
    const metaRegex = /<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g;
    let metaMatch;
    let email = "";
    let orderTotal = 0;
    let paidDate = "";
    const productIds: number[] = [];

    while ((metaMatch = metaRegex.exec(block)) !== null) {
      const metaBlock = metaMatch[1];
      const keyMatch =
        metaBlock.match(/<wp:meta_key>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:meta_key>/);
      const valueMatch =
        metaBlock.match(/<wp:meta_value>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/wp:meta_value>/);

      if (!keyMatch || !valueMatch) continue;
      const key = keyMatch[1].trim();
      const value = valueMatch[1].trim();

      switch (key) {
        case "_billing_email":
          email = value.toLowerCase().trim();
          break;
        case "_order_total":
          orderTotal = parseFloat(value) || 0;
          break;
        case "_paid_date":
        case "_date_paid":
        case "_completed_date":
          if (value && !paidDate) paidDate = value;
          break;
        case "_order_items":
        case "_order_line_items":
          // Serialized order items
          productIds.push(...extractProductIdsFromSerialized(value));
          break;
      }

      // Check for product_id in any meta that might contain it
      if (key.includes("product_id") && /^\d+$/.test(value)) {
        const pid = parseInt(value, 10);
        if (!productIds.includes(pid)) productIds.push(pid);
      }
    }

    // Skip non-completed/non-processing orders
    const validStatuses = [
      "wc-completed", "wc-processing", "completed", "processing",
    ];
    if (!validStatuses.includes(status)) continue;

    if (!email) continue;

    const finalDate = paidDate || orderDate;

    orders.push({
      orderId,
      email,
      orderTotal,
      orderDate: finalDate,
      status,
      productIds,
    });
  }

  return orders;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const contentType = req.headers.get("content-type") || "";
    let xmlText: string;
    let dryRun = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return new Response(JSON.stringify({ error: "No file provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      xmlText = await file.text();
      dryRun = formData.get("dryRun") === "true";
    } else {
      const body = await req.json();
      xmlText = body.xml;
      dryRun = body.dryRun === true;
    }

    console.log("XML length:", xmlText.length);

    const orders = parseOrdersFromXml(xmlText);
    console.log("Parsed orders:", orders.length);

    if (orders.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Inga beställningar hittades i XML-filen",
          total_orders: 0,
          matched: 0,
          created: 0,
          skipped: 0,
          errors: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load all profiles (email -> user_id)
    const emailToUserId = new Map<string, string>();
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: page } = await supabase
        .from("profiles")
        .select("email, user_id")
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      for (const p of page) {
        if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
      }
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    // Load all programs (wc_id -> program id)
    const { data: programs } = await supabase
      .from("programs")
      .select("id, wc_id, price, title");

    const wcIdToProgram = new Map<number, { id: string; price: number; title: string }>();
    const priceToPrograms = new Map<number, { id: string; wc_id: number | null; title: string }[]>();
    programs?.forEach((p) => {
      if (p.wc_id) wcIdToProgram.set(p.wc_id, { id: p.id, price: p.price, title: p.title });
      const price = Number(p.price);
      if (!priceToPrograms.has(price)) priceToPrograms.set(price, []);
      priceToPrograms.get(price)!.push({ id: p.id, wc_id: p.wc_id, title: p.title });
    });

    // Load existing purchases to avoid duplicates
    const { data: existingPurchases } = await supabase
      .from("purchases")
      .select("user_id, program_id");

    const existingSet = new Set<string>();
    existingPurchases?.forEach((p) => {
      existingSet.add(`${p.user_id}:${p.program_id}`);
    });

    console.log(
      `Profiles: ${emailToUserId.size}, Programs: ${wcIdToProgram.size}, Existing purchases: ${existingSet.size}`
    );

    const results = {
      total_orders: orders.length,
      matched_users: 0,
      unmatched_users: 0,
      created: 0,
      skipped_duplicate: 0,
      skipped_no_product: 0,
      errors: [] as { orderId: number; email: string; error: string }[],
      unmatched_emails: [] as string[],
    };

    for (const order of orders) {
      const userId = emailToUserId.get(order.email);
      if (!userId) {
        results.unmatched_users++;
        if (!results.unmatched_emails.includes(order.email)) {
          results.unmatched_emails.push(order.email);
        }
        continue;
      }
      results.matched_users++;

      // Determine which programs were ordered
      let matchedPrograms: { id: string; title: string }[] = [];

      if (order.productIds.length > 0) {
        // Direct product ID match
        for (const pid of order.productIds) {
          const prog = wcIdToProgram.get(pid);
          if (prog) matchedPrograms.push({ id: prog.id, title: prog.title });
        }
      }

      // Fallback: if no product IDs found, try matching by order total to a single product price
      if (matchedPrograms.length === 0 && order.orderTotal > 0) {
        const priceMatches = priceToPrograms.get(order.orderTotal);
        if (priceMatches && priceMatches.length === 1) {
          matchedPrograms.push({
            id: priceMatches[0].id,
            title: priceMatches[0].title,
          });
        }
      }

      if (matchedPrograms.length === 0) {
        results.skipped_no_product++;
        continue;
      }

      for (const prog of matchedPrograms) {
        const key = `${userId}:${prog.id}`;
        if (existingSet.has(key)) {
          results.skipped_duplicate++;
          continue;
        }

        if (!dryRun) {
          const purchaseDate = order.orderDate
            ? new Date(order.orderDate).toISOString()
            : new Date().toISOString();

          const amountPaid =
            matchedPrograms.length === 1
              ? order.orderTotal
              : wcIdToProgram.get(
                  order.productIds.find(
                    (pid) => wcIdToProgram.get(pid)?.id === prog.id
                  ) || 0
                )?.price || 0;

          const { error } = await supabase.from("purchases").insert({
            user_id: userId,
            program_id: prog.id,
            amount_paid: amountPaid,
            purchase_date: purchaseDate,
          });

          if (error) {
            results.errors.push({
              orderId: order.orderId,
              email: order.email,
              error: error.message,
            });
            continue;
          }
        }

        existingSet.add(key);
        results.created++;
      }
    }

    console.log("Results:", JSON.stringify(results));

    return new Response(JSON.stringify({ dryRun, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Import error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
