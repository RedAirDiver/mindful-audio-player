import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Parse MP3 frame header to estimate duration
function estimateMp3Duration(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  const fileSize = buffer.byteLength;

  // Skip ID3v2 tag if present
  let offset = 0;
  if (
    fileSize > 10 &&
    view.getUint8(0) === 0x49 && // 'I'
    view.getUint8(1) === 0x44 && // 'D'
    view.getUint8(2) === 0x33    // '3'
  ) {
    const size =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);
    offset = 10 + size;
  }

  // Find first valid MP3 frame sync
  const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const sampleRateTable = [44100, 48000, 32000, 0];

  for (let i = offset; i < Math.min(offset + 4096, fileSize - 4); i++) {
    if (view.getUint8(i) === 0xff && (view.getUint8(i + 1) & 0xe0) === 0xe0) {
      const header = view.getUint8(i + 1);
      const byte2 = view.getUint8(i + 2);

      const version = (header >> 3) & 0x03; // 3 = MPEG1
      const layer = (header >> 1) & 0x03;   // 1 = Layer III
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
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
    }

    // Get all audio files without duration
    const { data: tracks, error: fetchError } = await supabase
      .from("audio_files")
      .select("id, file_path, title")
      .is("duration_seconds", null);

    if (fetchError) throw fetchError;

    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ message: "Alla spår har redan en längd", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    let failed = 0;
    const results: { title: string; duration: number | null; error?: string }[] = [];

    for (const track of tracks) {
      try {
        const { data, error } = await supabase.storage
          .from("audio-files")
          .download(track.file_path);

        if (error || !data) {
          results.push({ title: track.title, duration: null, error: error?.message || "No data" });
          failed++;
          continue;
        }

        const buffer = await data.arrayBuffer();
        const duration = estimateMp3Duration(buffer);

        if (duration && duration > 0) {
          const { error: updateError } = await supabase
            .from("audio_files")
            .update({ duration_seconds: duration })
            .eq("id", track.id);

          if (updateError) {
            results.push({ title: track.title, duration, error: updateError.message });
            failed++;
          } else {
            results.push({ title: track.title, duration });
            updated++;
          }
        } else {
          results.push({ title: track.title, duration: null, error: "Kunde inte beräkna längd" });
          failed++;
        }
      } catch (err) {
        results.push({ title: track.title, duration: null, error: String(err) });
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ updated, failed, total: tracks.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
