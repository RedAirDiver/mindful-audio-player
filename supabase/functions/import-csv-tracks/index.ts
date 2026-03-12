import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CsvDownload {
  wc_id: number;
  product_name: string;
  track_order: number;
  download_name: string;
  download_url: string;
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
      } else if (ch === ',') {
        row.push(current);
        current = "";
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
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

function extractDownloads(headers: string[], row: string[]): { wc_id: number; product_name: string; downloads: { name: string; url: string; order: number }[] } {
  const idIdx = headers.indexOf("ID");
  const nameIdx = headers.indexOf("Namn");
  const wc_id = parseInt(row[idIdx] || "0");
  const product_name = row[nameIdx] || "";

  const downloads: { name: string; url: string; order: number }[] = [];

  for (let i = 1; i <= 80; i++) {
    const nameCol = `Ladda ner ${i} namn`;
    const urlCol = `Ladda ner ${i} URL`;
    const nameColIdx = headers.indexOf(nameCol);
    const urlColIdx = headers.indexOf(urlCol);

    if (nameColIdx === -1 || urlColIdx === -1) continue;
    const name = (row[nameColIdx] || "").trim();
    const url = (row[urlColIdx] || "").trim();
    if (!name && !url) continue;
    if (!url) continue;

    downloads.push({ name: name || `Spår ${i}`, url, order: i });
  }

  return { wc_id, product_name, downloads };
}

function extractFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").pop() || "";
  } catch {
    return url.split("/").pop() || "";
  }
}

function normalizeFilename(filename: string): string {
  return filename.toLowerCase().replace(/\.[^.]+$/, "");
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

    // Verify user token and extract user id (robust across runtimes)
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey);

    let userId: string | null = null;

    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (!claimsErr && claimsData?.claims?.sub) {
      userId = claimsData.claims.sub;
    }

    if (!userId) {
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
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
    const mode = (formData.get("mode") as string) || "rename"; // "rename" or "full"

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let csvText = await file.text();
    // Remove BOM
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return new Response(JSON.stringify({ error: "CSV is empty or invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = rows[0].map(h => h.replace(/^\uFEFF/, "").trim());

    // Get all programs
    const { data: programs } = await supabase
      .from("programs")
      .select("id, wc_id, title");

    // Get all audio files
    const { data: audioFiles } = await supabase
      .from("audio_files")
      .select("id, title, file_path, program_id");

    // Get all program_audio_files
    const { data: programAudioFiles } = await supabase
      .from("program_audio_files")
      .select("id, program_id, audio_file_id, track_order");

    const programsByWcId = new Map<number, any>();
    for (const p of programs || []) {
      if (p.wc_id) programsByWcId.set(p.wc_id, p);
    }

    // Build filename -> audio_file mapping
    const audioByFilename = new Map<string, any>();
    for (const af of audioFiles || []) {
      const filename = af.file_path.split("/").pop() || "";
      const normalized = normalizeFilename(filename);
      audioByFilename.set(normalized, af);
      // Also index by full filename
      audioByFilename.set(filename.toLowerCase(), af);
    }

    let titles_updated = 0;
    let tracks_created = 0;
    let tracks_linked = 0;
    let tracks_downloaded = 0;
    let failed = 0;
    let products_processed = 0;
    const details: string[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const { wc_id, product_name, downloads } = extractDownloads(headers, row);
      if (!wc_id || downloads.length === 0) continue;

      const program = programsByWcId.get(wc_id);
      if (!program) {
        details.push(`Produkt ${product_name} (wc_id ${wc_id}): ingen matchande produkt i systemet`);
        continue;
      }

      products_processed++;

      for (const dl of downloads) {
        const urlFilename = extractFilenameFromUrl(dl.url);
        const normalized = normalizeFilename(urlFilename);

        // Try to find existing audio file by filename
        let audioFile = audioByFilename.get(normalized) || audioByFilename.get(urlFilename.toLowerCase());

        // Also try matching by file_path containing the filename
        if (!audioFile) {
          for (const af of audioFiles || []) {
            const afFile = af.file_path.split("/").pop() || "";
            if (normalizeFilename(afFile) === normalized) {
              audioFile = af;
              break;
            }
          }
        }

        if (audioFile) {
          // Update title if it looks like a hash (no spaces, >20 chars hex-like)
          const currentTitle = audioFile.title;
          const isHashTitle = /^[0-9a-f]{20,}/.test(currentTitle) || 
                             currentTitle === urlFilename || 
                             currentTitle === normalizeFilename(urlFilename);

          if (isHashTitle && dl.name) {
            const { error: updateErr } = await supabase
              .from("audio_files")
              .update({ title: dl.name })
              .eq("id", audioFile.id);

            if (!updateErr) {
              titles_updated++;
            } else {
              failed++;
            }
          }

          // Ensure it's linked to the program
          const existingLink = (programAudioFiles || []).find(
            paf => paf.program_id === program.id && paf.audio_file_id === audioFile.id
          );

          if (!existingLink) {
            const { error: linkErr } = await supabase
              .from("program_audio_files")
              .insert({
                program_id: program.id,
                audio_file_id: audioFile.id,
                track_order: dl.order,
              });

            if (!linkErr) tracks_linked++;
          }
        } else if (mode === "full") {
          // Download and create new audio file
          try {
            const audioResponse = await fetch(dl.url);
            if (!audioResponse.ok) {
              details.push(`Kunde inte ladda ner: ${dl.name} (${dl.url})`);
              failed++;
              continue;
            }

            const audioBlob = await audioResponse.blob();
            const ext = urlFilename.split(".").pop() || "mp3";
            const storagePath = `audio/${wc_id}/${urlFilename}`;

            const { error: uploadErr } = await supabase.storage
              .from("audio-files")
              .upload(storagePath, audioBlob, {
                contentType: `audio/${ext === "mp3" ? "mpeg" : ext}`,
                upsert: true,
              });

            if (uploadErr) {
              details.push(`Upload misslyckades: ${dl.name}: ${uploadErr.message}`);
              failed++;
              continue;
            }

            // Create audio_file record
            const { data: newAudio, error: insertErr } = await supabase
              .from("audio_files")
              .insert({
                title: dl.name,
                file_path: storagePath,
                program_id: program.id,
                track_order: dl.order,
              })
              .select("id")
              .single();

            if (insertErr) {
              details.push(`Insert misslyckades: ${dl.name}: ${insertErr.message}`);
              failed++;
              continue;
            }

            tracks_created++;
            tracks_downloaded++;

            // Link to program
            await supabase.from("program_audio_files").insert({
              program_id: program.id,
              audio_file_id: newAudio.id,
              track_order: dl.order,
            });
            tracks_linked++;
          } catch (e) {
            details.push(`Fel vid nedladdning: ${dl.name}: ${e.message}`);
            failed++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        products_processed,
        titles_updated,
        tracks_created,
        tracks_downloaded,
        tracks_linked,
        failed,
        details: details.slice(0, 50),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
