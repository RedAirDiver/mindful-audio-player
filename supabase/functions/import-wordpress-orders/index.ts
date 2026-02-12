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
  wpUserId?: number; // CustomerUserID from WC export
}

/**
 * Safely parse a date string, returning ISO string or null.
 */
function safeDateToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    // Check if it's a Unix timestamp (all digits, typically 10 digits for seconds)
    if (/^\d{9,13}$/.test(dateStr.trim())) {
      let ts = parseInt(dateStr.trim(), 10);
      // If 10 digits, it's seconds; convert to ms
      if (ts < 1e12) ts = ts * 1000;
      const d = new Date(ts);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    // Try direct parse
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
    // Try replacing space with T for "2023-01-01 12:00:00" format
    const d2 = new Date(dateStr.replace(" ", "T"));
    if (!isNaN(d2.getTime())) return d2.toISOString();
  } catch { /* ignore */ }
  return null;
}

/**
 * Parse a localized number string (handles comma decimals, currency symbols).
 */
function parseLocalizedNumber(value: string): number {
  if (!value) return 0;
  let str = value.trim().replace(/[¤$€£¥\s]/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    str = str.replace(/,/g, "");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse serialized PHP arrays to extract product IDs.
 */
function extractProductIdsFromSerialized(value: string): number[] {
  const ids: number[] = [];
  const productIdRegex = /"_product_id";(?:s:\d+:"|i:)(\d+)/g;
  let match;
  while ((match = productIdRegex.exec(value)) !== null) {
    ids.push(parseInt(match[1], 10));
  }
  const simpleRegex = /product_id["\s:]+(\d+)/g;
  while ((match = simpleRegex.exec(value)) !== null) {
    const id = parseInt(match[1], 10);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Extract product IDs from WooCommerce order_item blocks.
 * WC XML exports order items as <wp:order_item> with <wp:order_item_meta> entries.
 */
function extractProductIdsFromOrderItems(block: string): number[] {
  const ids: number[] = [];
  
  // Match <wp:order_item> blocks
  const orderItemRegex = /<wp:order_item>([\s\S]*?)<\/wp:order_item>/g;
  let itemMatch;
  while ((itemMatch = orderItemRegex.exec(block)) !== null) {
    const itemBlock = itemMatch[1];
    // Look for <wp:order_item_meta> with _product_id
    const metaRegex = /<wp:order_item_meta>([\s\S]*?)<\/wp:order_item_meta>/g;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(itemBlock)) !== null) {
      const metaBlock = metaMatch[1];
      const keyMatch = metaBlock.match(/<wp:meta_key>(?:<!\[CDATA\[)?_product_id(?:\]\]>)?<\/wp:meta_key>/);
      if (keyMatch) {
        const valMatch = metaBlock.match(/<wp:meta_value>(?:<!\[CDATA\[)?(\d+)(?:\]\]>)?<\/wp:meta_value>/);
        if (valMatch) {
          const pid = parseInt(valMatch[1], 10);
          if (!ids.includes(pid)) ids.push(pid);
        }
      }
    }
  }
  
  // Also try extracting from serialized _order_items meta
  // And from direct meta keys containing product_id
  return ids;
}

/**
 * Parse the new WooCommerce export format: <data><post>...</post></data>
 * Uses direct element names like <OrderID>, <BillingEmailAddress>, etc.
 */
function parseOrdersFromDataPost(xmlText: string): OrderData[] {
  const orders: OrderData[] = [];
  const postRegex = /<post>([\s\S]*?)<\/post>/g;
  let postMatch;

  while ((postMatch = postRegex.exec(xmlText)) !== null) {
    const block = postMatch[1];

    const getVal = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
      return m ? m[1].trim() : "";
    };

    const status = getVal("OrderStatus");
    const validStatuses = ["wc-completed", "wc-processing", "completed", "processing"];
    if (!validStatuses.includes(status)) continue;

    const email = (getVal("BillingEmailAddress") || getVal("CustomerAccountEmailAddress")).toLowerCase().trim();
    if (!email) continue;

    const orderId = parseInt(getVal("OrderID"), 10) || 0;
    const orderTotal = parseLocalizedNumber(getVal("OrderTotal"));
    const wpUserId = parseInt(getVal("CustomerUserID"), 10) || undefined;

    // Date: prefer _paid_date, then _date_paid (unix), then OrderDate
    const paidDate = getVal("_paid_date");
    const datePaid = getVal("_date_paid");
    const orderDate = getVal("OrderDate");
    const finalDate = paidDate || datePaid || orderDate;

    orders.push({
      orderId,
      email,
      orderTotal,
      orderDate: finalDate,
      status,
      productIds: [], // This format doesn't include line items
      wpUserId,
    });
  }

  return orders;
}

function parseOrdersFromXml(xmlText: string): OrderData[] {
  const orders: OrderData[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const block = itemMatch[1];

    const postTypeMatch =
      block.match(/<wp:post_type>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:post_type>/);
    if (!postTypeMatch || postTypeMatch[1].trim() !== "shop_order") continue;

    const postIdMatch = block.match(/<wp:post_id>(\d+)<\/wp:post_id>/);
    const orderId = postIdMatch ? parseInt(postIdMatch[1], 10) : 0;

    const dateMatch =
      block.match(/<wp:post_date>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:post_date>/);
    const orderDate = dateMatch ? dateMatch[1].trim() : "";

    const statusMatch =
      block.match(/<wp:status>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:status>/);
    const status = statusMatch ? statusMatch[1].trim() : "";

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
        case "_order_total_base":
          if (orderTotal === 0) orderTotal = parseLocalizedNumber(value);
          break;
        case "_paid_date":
        case "_date_paid":
        case "_completed_date":
          if (value && !paidDate) paidDate = value;
          break;
        case "_order_items":
        case "_order_line_items":
          productIds.push(...extractProductIdsFromSerialized(value));
          break;
      }

      if (key.includes("product_id") && /^\d+$/.test(value)) {
        const pid = parseInt(value, 10);
        if (!productIds.includes(pid)) productIds.push(pid);
      }
    }

    const orderItemIds = extractProductIdsFromOrderItems(block);
    for (const pid of orderItemIds) {
      if (!productIds.includes(pid)) productIds.push(pid);
    }

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

/**
 * Parse CSV text (WooCommerce order export) into OrderData[].
 * Expected columns (case-insensitive): Order ID / order_number, Email / billing_email,
 * Order Total / order_total, Order Date / date_created, Status / order_status,
 * Product ID(s) / product_id (comma-separated).
 */
function parseOrdersFromCsv(csvText: string): OrderData[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().trim());

  const colIndex = (names: string[]): number => {
    for (const n of names) {
      const idx = headers.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iOrder = colIndex(["order_number", "order id", "order_id", "id"]);
  const iEmail = colIndex(["billing_email", "email", "billing email", "customer_email"]);
  const iTotal = colIndex(["order_total", "order total", "total", "cart_total"]);
  const iDate = colIndex(["order_date", "date_created", "date", "order date", "date_paid", "completed_date"]);
  const iStatus = colIndex(["status", "order_status", "order status"]);
  const iProduct = colIndex(["product_id", "product id", "product_ids", "line_item_product_id", "item_id"]);
  const iProductName = colIndex(["product_name", "item_name", "line_item_name"]);

  console.log(`CSV columns found: order=${iOrder}, email=${iEmail}, total=${iTotal}, date=${iDate}, status=${iStatus}, product=${iProduct}`);

  if (iEmail === -1) {
    console.error("CSV missing email column. Headers:", headers.join(", "));
    return [];
  }

  const orders: OrderData[] = [];
  // Group rows by order ID (WC CSV exports one row per line item)
  const orderMap = new Map<string, OrderData>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    const email = (iEmail >= 0 ? cols[iEmail] : "").toLowerCase().trim();
    if (!email) continue;

    const orderId = iOrder >= 0 ? parseInt(cols[iOrder], 10) || i : i;
    const orderTotal = iTotal >= 0 ? parseFloat(cols[iTotal]) || 0 : 0;
    const orderDate = iDate >= 0 ? cols[iDate] || "" : "";
    const status = iStatus >= 0 ? cols[iStatus]?.toLowerCase().trim() || "completed" : "completed";

    // Filter by status
    const validStatuses = ["wc-completed", "wc-processing", "completed", "processing"];
    if (!validStatuses.includes(status)) continue;

    const productIds: number[] = [];
    if (iProduct >= 0 && cols[iProduct]) {
      const parts = cols[iProduct].split(/[,;]/);
      for (const p of parts) {
        const pid = parseInt(p.trim(), 10);
        if (!isNaN(pid) && pid > 0) productIds.push(pid);
      }
    }

    const key = `${orderId}-${email}`;
    const existing = orderMap.get(key);
    if (existing) {
      // Merge product IDs from additional line items
      for (const pid of productIds) {
        if (!existing.productIds.includes(pid)) existing.productIds.push(pid);
      }
    } else {
      orderMap.set(key, {
        orderId,
        email,
        orderTotal,
        orderDate,
        status,
        productIds,
      });
    }
  }

  return Array.from(orderMap.values());
}

/**
 * Simple CSV line parser that handles quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
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
    let fileText: string;
    let fileName = "";
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
      fileText = await file.text();
      fileName = file.name || "";
      dryRun = formData.get("dryRun") === "true";
    } else {
      const body = await req.json();
      fileText = body.xml || body.csv || "";
      fileName = body.fileName || "";
      dryRun = body.dryRun === true;
    }

    console.log("File length:", fileText.length, "Name:", fileName);

    // Detect format: <data><post> format, WXR <item> format, or CSV
    const isDataPost = fileText.includes("<data>") && fileText.includes("<post>");
    const isCsv = fileName.toLowerCase().endsWith(".csv") ||
      (!fileName.toLowerCase().endsWith(".xml") && !fileText.trimStart().startsWith("<?xml") && !fileText.trimStart().startsWith("<"));

    let orders: OrderData[];
    if (isCsv) {
      orders = parseOrdersFromCsv(fileText);
    } else if (isDataPost) {
      orders = parseOrdersFromDataPost(fileText);
    } else {
      orders = parseOrdersFromXml(fileText);
    }
    const formatName = isCsv ? "CSV" : isDataPost ? "DataPost-XML" : "WXR-XML";
    console.log(`Parsed ${orders.length} orders (format: ${formatName})`);
    
    // Debug: log first 3 orders to see product ID extraction
    for (let i = 0; i < Math.min(3, orders.length); i++) {
      console.log(`Order ${orders[i].orderId}: email=${orders[i].email}, productIds=${JSON.stringify(orders[i].productIds)}, total=${orders[i].orderTotal}, date=${orders[i].orderDate}`);
    }
    
    // Debug: check if XML contains wp:order_item tags
    const orderItemCount = (fileText.match(/<wp:order_item>/g) || []).length;
    if (orderItemCount > 0) console.log("wp:order_item tags found:", orderItemCount);

    if (orders.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Inga beställningar hittades i filen",
          total_orders: 0,
          matched: 0,
          created: 0,
          skipped: 0,
          errors: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load all profiles (email -> user_id, wp_user_id -> user_id)
    const emailToUserId = new Map<string, string>();
    const wpUserIdToUserId = new Map<number, string>();
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: page } = await supabase
        .from("profiles")
        .select("email, user_id, wp_user_id")
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      for (const p of page) {
        if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
        if (p.wp_user_id) wpUserIdToUserId.set(p.wp_user_id, p.user_id);
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
      // Try email first, then wp_user_id
      const userId = emailToUserId.get(order.email) || 
        (order.wpUserId ? wpUserIdToUserId.get(order.wpUserId) : undefined);
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
          const purchaseDate = safeDateToISO(order.orderDate) || new Date().toISOString();

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
