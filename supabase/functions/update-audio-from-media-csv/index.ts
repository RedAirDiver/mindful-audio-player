import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Strip WP random suffix like "-lrezn5" from filename
function stripWpSuffix(filename: string): string {
  return filename.replace(/-[a-z0-9]{4,8}(\.\w+)$/, "$1");
}

// Normalize for matching: lowercase, strip extension, leading numbers, non-alpha
function normalizeForMatch(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")       // remove extension
    .replace(/^\d+[\.\-_]\s*/, "")  // remove leading track number
    .replace(/[^a-z0-9]/g, "");     // only alphanumeric
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") i++;
        row.push(current);
        current = "";
        if (row.length > 1) rows.push(row);
        row = [];
      } else {
        current += ch;
      }
    }
  }
  row.push(current);
  if (row.length > 1) rows.push(row);
  return rows;
}

function cleanDescription(desc: string): string {
  // Remove surrounding quotes and trailing period
  let d = desc.trim();
  if (d.startsWith('"') && d.endsWith('"')) d = d.slice(1, -1);
  if (d.startsWith('\u201C')) d = d.slice(1);
  if (d.endsWith('\u201D')) d = d.slice(0, -1);
  // Decode HTML entities
  d = d.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  // Remove trailing period and dot
  d = d.replace(/\.\s*$/, "").trim();
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const dryRun = (formData.get("dryRun") as string) !== "false";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let csvText = await file.text();
    if (csvText.charCodeAt(0) === 0xfeff) csvText = csvText.slice(1);

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return new Response(JSON.stringify({ error: "CSV is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = rows[0].map((h) => h.replace(/^\uFEFF/, "").trim());
    const fileIdx = headers.indexOf("File");
    const titleIdx = headers.indexOf("Title");
    const descIdx = headers.indexOf("Description");

    if (fileIdx === -1 || titleIdx === -1) {
      return new Response(JSON.stringify({ error: "CSV must have 'File' and 'Title' columns" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build CSV lookup: normalized filename -> { title, description }
    const csvEntries: Array<{ csvFilename: string; title: string; description: string }> = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const filename = (row[fileIdx] || "").trim();
      const title = (row[titleIdx] || "").trim();
      const description = descIdx >= 0 ? cleanDescription(row[descIdx] || "") : "";
      if (filename) {
        csvEntries.push({ csvFilename: filename, title, description });
      }
    }

    // Get all audio files from DB
    const { data: audioFiles } = await supabase
      .from("audio_files")
      .select("id, title, description, file_path");

    // Build lookup maps for DB audio files
    const dbByNormalized = new Map<string, any[]>();
    for (const af of audioFiles || []) {
      const dbFilename = af.file_path.split("/").pop() || "";
      const stripped = stripWpSuffix(dbFilename);
      const norm = normalizeForMatch(stripped);
      if (!dbByNormalized.has(norm)) dbByNormalized.set(norm, []);
      dbByNormalized.get(norm)!.push(af);
    }

    const updates: Array<{
      audioId: string;
      oldTitle: string;
      newTitle: string;
      newDescription: string;
      filePath: string;
      matchMethod: string;
    }> = [];
    const notFound: string[] = [];

    for (const entry of csvEntries) {
      const csvStripped = stripWpSuffix(entry.csvFilename);
      const csvNorm = normalizeForMatch(csvStripped);

      const matches = dbByNormalized.get(csvNorm);
      if (!matches || matches.length === 0) {
        notFound.push(entry.csvFilename);
        continue;
      }

      for (const af of matches) {
        // Skip if title is a hash (useless from CSV too)
        const isHashTitle = /^[a-f0-9]{20,}$/i.test(entry.title);
        if (isHashTitle) continue;

        const titleChanged = af.title !== entry.title && entry.title;
        const descChanged = (af.description || "") !== entry.description && entry.description;

        if (titleChanged || descChanged) {
          updates.push({
            audioId: af.id,
            oldTitle: af.title,
            newTitle: entry.title || af.title,
            newDescription: entry.description,
            filePath: af.file_path,
            matchMethod: "normalized",
          });
        }
      }
    }

    if (!dryRun) {
      let updatedCount = 0;
      for (const u of updates) {
        const updateData: Record<string, string> = {};
        if (u.newTitle && u.newTitle !== u.oldTitle) updateData.title = u.newTitle;
        if (u.newDescription) updateData.description = u.newDescription;

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from("audio_files")
            .update(updateData)
            .eq("id", u.audioId);
          if (!error) updatedCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updatedCount,
          totalMatched: updates.length,
          notFoundCount: notFound.length,
          sampleUpdates: updates.slice(0, 10),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        dryRun: true,
        csvRows: csvEntries.length,
        totalMatched: updates.length,
        notFoundCount: notFound.length,
        updates: updates.slice(0, 30),
        notFound: notFound.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
