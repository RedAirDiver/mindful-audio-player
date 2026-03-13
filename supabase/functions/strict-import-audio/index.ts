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

    // Support new format: Product Title, File Name, File URL
    const productTitleIdx = headers.indexOf("Product Title");
    const fileNameIdx = headers.indexOf("File Name");
    const fileUrlIdx = headers.indexOf("File URL");

    if (productTitleIdx === -1 || fileNameIdx === -1) {
      return new Response(JSON.stringify({ error: "CSV must have 'Product Title' and 'File Name' columns" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse CSV entries
    const csvEntries: Array<{
      productTitle: string;
      fileName: string;
      fileUrl: string;
    }> = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const productTitle = (row[productTitleIdx] || "").trim();
      const fileName = (row[fileNameIdx] || "").trim();
      const fileUrl = fileUrlIdx >= 0 ? (row[fileUrlIdx] || "").trim() : "";
      if (productTitle && fileName) {
        csvEntries.push({ productTitle, fileName, fileUrl });
      }
    }

    // Get all programs and match by title
    const { data: programs } = await supabase
      .from("programs")
      .select("id, wc_id, title");

    const programsByTitle = new Map<string, any>();
    for (const p of programs || []) {
      programsByTitle.set(p.title.toLowerCase().trim(), p);
    }

    // List ALL files from storage to build a lookup
    const storageFiles: { path: string; normalizedName: string; folder: string; originalName: string }[] = [];

    const { data: topFolders } = await supabase.storage
      .from("audio-files")
      .list("", { limit: 1000 });

    for (const item of topFolders || []) {
      if (!item.id) {
        // It's a folder
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
                    originalName: f.name,
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
                originalName: f.name,
              });
            }
          }
        }
      }
    }

    // Build normalized lookup
    const storageByNorm = new Map<string, typeof storageFiles[0]>();
    for (const sf of storageFiles) {
      const existing = storageByNorm.get(sf.normalizedName);
      if (!existing) {
        storageByNorm.set(sf.normalizedName, sf);
      } else {
        const existingFilename = existing.path.split("/").pop() || "";
        const newFilename = sf.path.split("/").pop() || "";
        if (newFilename.length < existingFilename.length) {
          storageByNorm.set(sf.normalizedName, sf);
        }
      }
    }

    // Track order per program
    const programTrackCounters = new Map<string, number>();

    // Match each CSV entry
    const matched: Array<{
      title: string;
      filePath: string;
      programId: string | null;
      programTitle: string;
      trackOrder: number;
      foundInStorage: boolean;
      csvFileName: string;
      fileUrl: string;
    }> = [];

    const unmatchedPrograms = new Set<string>();

    for (const entry of csvEntries) {
      // Match program by title
      const program = programsByTitle.get(entry.productTitle.toLowerCase().trim());
      const programId = program?.id || null;

      if (!programId) {
        unmatchedPrograms.add(entry.productTitle);
      }

      // Track order: increment per program
      const counterKey = programId || entry.productTitle;
      const currentOrder = (programTrackCounters.get(counterKey) || 0) + 1;
      programTrackCounters.set(counterKey, currentOrder);

      // Try to find the file in storage by normalizing the File Name
      const csvNorm = normalizeForMatch(stripWpSuffix(entry.fileName));
      const storageFile = storageByNorm.get(csvNorm);

      let filePath = `missing/${entry.fileName}`;
      let foundInStorage = false;

      if (storageFile) {
        filePath = storageFile.path;
        foundInStorage = true;
      }

      // Use File Name without extension as title
      const title = entry.fileName.replace(/\.[^/.]+$/, "");

      matched.push({
        title,
        filePath,
        programId,
        programTitle: entry.productTitle,
        trackOrder: currentOrder,
        foundInStorage,
        csvFileName: entry.fileName,
      });
    }

    const notFoundFiles = matched.filter((m) => !m.foundInStorage).map((m) => m.csvFileName);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          csvRows: csvEntries.length,
          matched: matched.filter((m) => m.foundInStorage).length,
          notFoundInStorage: notFoundFiles.length,
          totalToCreate: matched.length,
          unmatchedPrograms: Array.from(unmatchedPrograms),
          programsMatched: new Set(matched.filter((m) => m.programId).map((m) => m.programTitle)).size,
          notFoundFiles: notFoundFiles.slice(0, 50),
          preview: matched.slice(0, 30).map((m) => ({
            title: m.title,
            filePath: m.filePath,
            programTitle: m.programTitle,
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
      // Store source URL in description for later download
      const sourceUrl = !m.foundInStorage && m.fileUrl ? m.fileUrl : null;
      const { data: newAudio, error: insertErr } = await supabase
        .from("audio_files")
        .insert({
          title: m.title,
          file_path: m.filePath,
          program_id: m.programId,
          track_order: m.trackOrder,
          description: sourceUrl,
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
        foundInStorage: matched.filter((m) => m.foundInStorage).length,
        notFoundInStorage: notFoundFiles.length,
        unmatchedPrograms: Array.from(unmatchedPrograms),
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
