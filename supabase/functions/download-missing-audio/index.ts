import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 1;
const DOWNLOAD_TIMEOUT_MS = 45000;
const DOWNLOAD_PROBE_TIMEOUT_MS = 15000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const URL_FILTER = "description.like.http://%,description.like.https://%";

async function countRemainingDownloadable(supabase: ReturnType<typeof createClient>) {
  const { count } = await supabase
    .from("audio_files")
    .select("id", { count: "exact", head: true })
    .like("file_path", "missing/%")
    .or(URL_FILTER);

  return count || 0;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("download_timeout"), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeRemoteFileSize(url: string): Promise<number | null> {
  try {
    const headResponse = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, DOWNLOAD_PROBE_TIMEOUT_MS);
    if (headResponse.ok) {
      const contentLength = Number(headResponse.headers.get("content-length") || "0");
      if (Number.isFinite(contentLength) && contentLength > 0) {
        return contentLength;
      }
    }
  } catch {
    // ignore and try range probe instead
  }

  try {
    const rangeResponse = await fetchWithTimeout(
      url,
      {
        method: "GET",
        redirect: "follow",
        headers: { Range: "bytes=0-0" },
      },
      DOWNLOAD_PROBE_TIMEOUT_MS,
    );

    const contentRange = rangeResponse.headers.get("content-range") || "";
    const sizeMatch = contentRange.match(/\/(\d+)$/);
    if (sizeMatch) {
      const size = Number(sizeMatch[1]);
      if (Number.isFinite(size) && size > 0) {
        await rangeResponse.arrayBuffer(); // consume body
        return size;
      }
    }

    const contentLength = Number(rangeResponse.headers.get("content-length") || "0");
    await rangeResponse.arrayBuffer(); // consume body
    if (Number.isFinite(contentLength) && contentLength > 0) {
      return contentLength;
    }
  } catch {
    // no-op
  }

  return null;
}

async function readResponseWithLimit(response: Response, maxBytes: number): Promise<Blob> {
  const contentType = response.headers.get("content-type") || "application/octet-stream";

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error(`File too large (${buffer.byteLength} bytes)`);
    }
    return new Blob([buffer], { type: contentType });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`File too large (${total} bytes)`);
    }

    chunks.push(value);
  }

  return new Blob(chunks, { type: contentType });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsErr || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find files with missing/ path that have a URL stored in description
    const { data: tracks, error: fetchError } = await supabase
      .from("audio_files")
      .select("id, file_path, title, description, program_id")
      .like("file_path", "missing/%")
      .or(URL_FILTER)
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;

    if (!tracks || tracks.length === 0) {
      const remaining = await countRemainingDownloadable(supabase);
      return new Response(
        JSON.stringify({
          done: true,
          downloaded: 0,
          failed: 0,
          remaining,
          message: "Inga fler filer med URL att ladda ner",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let downloaded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const track of tracks) {
      const url = track.description;
      if (!url || !url.startsWith("http")) {
        await supabase.from("audio_files").update({ description: null }).eq("id", track.id);
        failed++;
        continue;
      }

      try {
        console.log(`Downloading: ${track.title} from ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort("download_timeout"), DOWNLOAD_TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(url, { signal: controller.signal, redirect: "follow" });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          errors.push(`${track.title}: HTTP ${response.status}`);
          failed++;
          await supabase
            .from("audio_files")
            .update({ description: `download_failed_${response.status}` })
            .eq("id", track.id);
          continue;
        }

        const contentLength = Number(response.headers.get("content-length") || "0");
        if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) {
          errors.push(`${track.title}: File too large (${contentLength} bytes)`);
          failed++;
          await supabase
            .from("audio_files")
            .update({ description: "download_failed_too_large" })
            .eq("id", track.id);
          continue;
        }

        // Sanitize filename: replace spaces/special chars with underscores
        const rawFilename = track.file_path.replace("missing/", "");
        const filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const ext = filename.split(".").pop()?.toLowerCase() || "mp3";
        const contentType = ext === "mp3" ? "audio/mpeg" : ext === "m4a" || ext === "mp4" ? "audio/mp4" : `audio/${ext}`;

        // Determine storage path using program's wc_id if available
        let storagePath: string;
        if (track.program_id) {
          const { data: program } = await supabase
            .from("programs")
            .select("wc_id")
            .eq("id", track.program_id)
            .single();

          const folder = program?.wc_id || track.program_id;
          storagePath = `audio/${folder}/${filename}`;
        } else {
          storagePath = `audio/unassigned/${filename}`;
        }

        const fileBlob = await readResponseWithLimit(response, MAX_FILE_BYTES);

        const { error: uploadErr } = await supabase.storage.from("audio-files").upload(storagePath, fileBlob, {
          contentType,
          upsert: true,
        });

        if (uploadErr) {
          errors.push(`${track.title}: Upload: ${uploadErr.message}`);
          failed++;
          await supabase
            .from("audio_files")
            .update({ description: "download_failed_upload" })
            .eq("id", track.id);
          continue;
        }

        // Update DB: set real path, clear description (URL)
        const { error: updateErr } = await supabase
          .from("audio_files")
          .update({ file_path: storagePath, description: null })
          .eq("id", track.id);

        if (updateErr) {
          errors.push(`${track.title}: DB update: ${updateErr.message}`);
          failed++;
          await supabase
            .from("audio_files")
            .update({ description: "download_failed_db_update" })
            .eq("id", track.id);
        } else {
          downloaded++;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        errors.push(`${track.title}: ${reason}`);
        failed++;
        await supabase
          .from("audio_files")
          .update({ description: reason.includes("too large") ? "download_failed_too_large" : "download_failed_exception" })
          .eq("id", track.id);
      }
    }

    const remaining = await countRemainingDownloadable(supabase);

    return new Response(
      JSON.stringify({
        downloaded,
        failed,
        remaining,
        done: remaining === 0,
        errors: errors.slice(0, 10),
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
