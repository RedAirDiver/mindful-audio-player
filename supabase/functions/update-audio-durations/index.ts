import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Parse MP3 frame header to estimate duration
function estimateMp3Duration(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  const fileSize = buffer.byteLength;

  let offset = 0;
  if (
    fileSize > 10 &&
    view.getUint8(0) === 0x49 &&
    view.getUint8(1) === 0x44 &&
    view.getUint8(2) === 0x33
  ) {
    const size =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);
    offset = 10 + size;
  }

  const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];

  for (let i = offset; i < Math.min(offset + 4096, fileSize - 4); i++) {
    if (view.getUint8(i) === 0xff && (view.getUint8(i + 1) & 0xe0) === 0xe0) {
      const header = view.getUint8(i + 1);
      const byte2 = view.getUint8(i + 2);
      const version = (header >> 3) & 0x03;
      const layer = (header >> 1) & 0x03;
      const bitrateIdx = (byte2 >> 4) & 0x0f;
      const sampleRateIdx = (byte2 >> 2) & 0x03;

      if (version === 3 && layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && sampleRateIdx < 3) {
        const bitrate = bitrateTable[bitrateIdx] * 1000;
        const audioDataSize = fileSize - i;
        const durationSec = (audioDataSize * 8) / bitrate;
        return Math.round(durationSec);
      }
    }
  }

  return null;
}

// Parse M4A/MP4 to find duration from moov/mvhd atom
function estimateM4aDuration(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  const fileSize = buffer.byteLength;

  // Search for 'mvhd' atom which contains duration info
  for (let i = 0; i < fileSize - 8; i++) {
    if (
      view.getUint8(i) === 0x6d && // m
      view.getUint8(i + 1) === 0x76 && // v
      view.getUint8(i + 2) === 0x68 && // h
      view.getUint8(i + 3) === 0x64    // d
    ) {
      // Found mvhd atom
      const version = view.getUint8(i + 4);
      let timescale: number;
      let duration: number;

      if (version === 0) {
        // Version 0: 4-byte fields
        timescale = view.getUint32(i + 16);
        duration = view.getUint32(i + 20);
      } else {
        // Version 1: 8-byte fields (use lower 32 bits)
        timescale = view.getUint32(i + 24);
        // Duration is 8 bytes, read upper and lower
        const durHigh = view.getUint32(i + 28);
        const durLow = view.getUint32(i + 32);
        duration = durHigh * 0x100000000 + durLow;
      }

      if (timescale > 0 && duration > 0) {
        return Math.round(duration / timescale);
      }
    }
  }

  return null;
}

function getDurationEstimator(filePath: string): (buf: ArrayBuffer) => number | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4") || lower.endsWith(".aac")) {
    return estimateM4aDuration;
  }
  return estimateMp3Duration;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all audio files without duration that have real files (not missing/)
    const { data: tracks, error: fetchError } = await supabase
      .from("audio_files")
      .select("id, file_path, title")
      .is("duration_seconds", null)
      .not("file_path", "like", "missing/%");

    if (fetchError) throw fetchError;

    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ message: "Inga spår att uppdatera", updated: 0, failed: 0, skipped_missing: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const track of tracks) {
      try {
        const { data, error } = await supabase.storage
          .from("audio-files")
          .download(track.file_path);

        if (error || !data) {
          errors.push(`${track.title}: ${error?.message || "No data"}`);
          failed++;
          continue;
        }

        const buffer = await data.arrayBuffer();
        const estimator = getDurationEstimator(track.file_path);
        const duration = estimator(buffer);

        if (duration && duration > 0) {
          const { error: updateError } = await supabase
            .from("audio_files")
            .update({ duration_seconds: duration })
            .eq("id", track.id);

          if (updateError) {
            errors.push(`${track.title}: ${updateError.message}`);
            failed++;
          } else {
            updated++;
          }
        } else {
          errors.push(`${track.title}: Kunde inte beräkna längd`);
          failed++;
        }
      } catch (err) {
        errors.push(`${track.title}: ${String(err)}`);
        failed++;
      }
    }

    // Count missing files
    const { count: missingCount } = await supabase
      .from("audio_files")
      .select("id", { count: "exact", head: true })
      .is("duration_seconds", null)
      .like("file_path", "missing/%");

    return new Response(
      JSON.stringify({ updated, failed, total: tracks.length, skipped_missing: missingCount || 0, errors: errors.slice(0, 30) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
