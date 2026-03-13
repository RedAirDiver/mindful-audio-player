import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  let d = desc.trim();
  if (d.startsWith('"') && d.endsWith('"')) d = d.slice(1, -1);
  if (d.startsWith('\u201C')) d = d.slice(1);
  if (d.endsWith('\u201D')) d = d.slice(0, -1);
  d = d.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  d = d.replace(/\.\s*$/, "").trim();
  return d;
}

// Strip WP hash suffix like "-lrezn5" from filename
function stripWpSuffix(filename: string): string {
  return filename.replace(/-[a-z0-9]{4,8}(\.\w+)$/, "$1");
}

// Normalize for matching: lowercase, strip extension, remove non-alphanumeric
function normalizeForMatch(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]/g, "");
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

    // Parse all CSV entries
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

    // Get all programs for wc_id mapping
    const { data: programs } = await supabase
      .from("programs")
      .select("id, wc_id, title");

    const programsByWcId = new Map<number, any>();
    const programsById = new Map<string, any>();
    for (const p of programs || []) {
      if (p.wc_id) programsByWcId.set(p.wc_id, p);
      programsById.set(p.id, p);
    }

    // List ALL files from storage to build a lookup
    const storageFiles: { path: string; normalizedName: string; folder: string }[] = [];
    
    const { data: topFolders } = await supabase.storage
      .from("audio-files")
      .list("", { limit: 1000 });

    for (const item of topFolders || []) {
      if (!item.id) {
        // folder
        if (item.name === "audio") {
          const { data: wcFolders } = await supabase.storage
            .from("audio-files")
            .list("audio", { limit: 1000 });
          for (const wcFolder of wcFolders || []) {
            if (!wcFolder.id) {
              const { data: files } = await supabase.storage
                .from("audio-files")
                .list(`audio/${wcFolder.name}`, { limit: 1000 });
              for (const f of files || []) {
                if (f.id && f.name) {
                  const path = `audio/${wcFolder.name}/${f.name}`;
                  storageFiles.push({
                    path,
                    normalizedName: normalizeForMatch(stripWpSuffix(f.name)),
                    folder: wcFolder.name,
                  });
                }
              }
            }
          }
        } else {
          const { data: files } = await supabase.storage
            .from("audio-files")
            .list(item.name, { limit: 1000 });
          for (const f of files || []) {
            if (f.id && f.name) {
              const path = `${item.name}/${f.name}`;
              storageFiles.push({
                path,
                normalizedName: normalizeForMatch(stripWpSuffix(f.name)),
                folder: item.name,
              });
            }
          }
        }
      }
    }

    // Build normalized lookup: normalized name -> best storage file (prefer non-hash)
    const storageByNorm = new Map<string, typeof storageFiles[0]>();
    for (const sf of storageFiles) {
      const existing = storageByNorm.get(sf.normalizedName);
      if (!existing) {
        storageByNorm.set(sf.normalizedName, sf);
      } else {
        // Prefer path without hash suffix (shorter = cleaner)
        const existingFilename = existing.path.split("/").pop() || "";
        const newFilename = sf.path.split("/").pop() || "";
        if (newFilename.length < existingFilename.length) {
          storageByNorm.set(sf.normalizedName, sf);
        }
      }
    }

    // Match each CSV entry to a storage file, but create ALL entries regardless
    const matched: Array<{
      title: string;
      description: string;
      filePath: string;
      programId: string | null;
      trackOrder: number;
      csvFilename: string;
      foundInStorage: boolean;
    }> = [];

    for (const entry of csvEntries) {
      const csvNorm = normalizeForMatch(stripWpSuffix(entry.csvFilename));
      const storageFile = storageByNorm.get(csvNorm);

      // Determine program from folder (if storage match exists)
      let programId: string | null = null;
      let filePath = `missing/${entry.csvFilename}`;

      if (storageFile) {
        filePath = storageFile.path;
        const wcId = parseInt(storageFile.folder);
        if (wcId && programsByWcId.has(wcId)) {
          programId = programsByWcId.get(wcId)!.id;
        } else if (programsById.has(storageFile.folder)) {
          programId = storageFile.folder;
        }
      }

      // Extract track order from filename
      const trackMatch = entry.csvFilename.match(/^(\d+)[\.\-_\s]/);
      const trackOrder = trackMatch ? parseInt(trackMatch[1]) : 1;

      // Use CSV title, skip if it's a hash
      const isHashTitle = /^[a-f0-9]{20,}$/i.test(entry.title);
      const finalTitle = isHashTitle ? entry.csvFilename.replace(/\.[^/.]+$/, "") : entry.title;

      matched.push({
        title: finalTitle,
        description: entry.description,
        filePath,
        programId,
        trackOrder,
        csvFilename: entry.csvFilename,
        foundInStorage: !!storageFile,
      });
    }

    const notFoundFiles = matched.filter(m => !m.foundInStorage).map(m => m.csvFilename);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          csvRows: csvEntries.length,
          matched: matched.filter(m => m.foundInStorage).length,
          notFoundInStorage: notFoundFiles.length,
          totalToCreate: matched.length,
          notFoundFiles: notFoundFiles.slice(0, 50),
          preview: matched.slice(0, 20).map(m => ({
            title: m.title,
            filePath: m.filePath,
            programId: m.programId,
            trackOrder: m.trackOrder,
            foundInStorage: m.foundInStorage,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STRICT MODE: Delete all existing records first
    await supabase.from("program_audio_files").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("audio_files").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Create new records
    let created = 0;
    let linked = 0;
    let failed = 0;

    for (const m of matched) {
      const { data: newAudio, error: insertErr } = await supabase
        .from("audio_files")
        .insert({
          title: m.title,
          description: m.description || null,
          file_path: m.filePath,
          program_id: m.programId,
          track_order: m.trackOrder,
        })
        .select("id")
        .single();

      if (insertErr) {
        failed++;
        continue;
      }
      created++;

      if (m.programId) {
        const { error: linkErr } = await supabase
          .from("program_audio_files")
          .insert({
            program_id: m.programId,
            audio_file_id: newAudio.id,
            track_order: m.trackOrder,
          });
        if (!linkErr) linked++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        csvRows: csvEntries.length,
        totalCreated: created,
        linked,
        failed,
        foundInStorage: matched.filter(m => m.foundInStorage).length,
        notFoundInStorage: notFoundFiles.length,
        notFoundFiles: notFoundFiles.slice(0, 50),
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
