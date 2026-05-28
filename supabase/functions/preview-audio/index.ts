// Public preview-audio proxy.
// Streams only the first ~3 MB (~3 minutes at 128 kbps) of an audio track,
// so anonymous users can hear the 1:00–2:30 preview window but cannot
// download full paid tracks even if they guess track IDs or file paths.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
};

// Hard cap on bytes served per preview request. ~3 MB covers the
// 1:00–2:30 preview window with margin at 128 kbps MP3.
const PREVIEW_MAX_BYTES = 3 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const trackId = url.searchParams.get("track_id");
    if (!trackId || !/^[0-9a-f-]{36}$/i.test(trackId)) {
      return new Response("Invalid track_id", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: track, error: trackErr } = await supabase
      .from("audio_files")
      .select("file_path")
      .eq("id", trackId)
      .maybeSingle();

    if (trackErr || !track?.file_path) {
      return new Response("Track not found", { status: 404, headers: corsHeaders });
    }

    // Issue a short-lived signed URL server-side so the raw URL never leaves the function
    const { data: signed, error: signErr } = await supabase.storage
      .from("audio-files")
      .createSignedUrl(track.file_path, 60);

    if (signErr || !signed?.signedUrl) {
      return new Response("File unavailable", { status: 404, headers: corsHeaders });
    }

    // Honour the browser's Range request but cap end at PREVIEW_MAX_BYTES - 1
    const rangeHeader = req.headers.get("range") || "";
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    let start = 0;
    let end = PREVIEW_MAX_BYTES - 1;
    if (match) {
      if (match[1]) start = parseInt(match[1], 10);
      if (match[2]) end = Math.min(parseInt(match[2], 10), PREVIEW_MAX_BYTES - 1);
    }
    if (start >= PREVIEW_MAX_BYTES) {
      return new Response("Requested range not satisfiable", {
        status: 416,
        headers: { ...corsHeaders, "Content-Range": `bytes */${PREVIEW_MAX_BYTES}` },
      });
    }
    if (end < start) end = PREVIEW_MAX_BYTES - 1;

    const upstreamRes = await fetch(signed.signedUrl, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new Response("Upstream error", { status: 502, headers: corsHeaders });
    }

    const contentType = upstreamRes.headers.get("content-type") || "audio/mpeg";
    const upstreamLen = upstreamRes.headers.get("content-length");
    const length = upstreamLen ? Math.min(parseInt(upstreamLen, 10), end - start + 1) : end - start + 1;

    const headers: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
      "Content-Length": String(length),
      "Content-Range": `bytes ${start}-${start + length - 1}/${PREVIEW_MAX_BYTES}`,
    };

    return new Response(upstreamRes.body, {
      status: 206,
      headers,
    });
  } catch (err) {
    console.error("preview-audio error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
