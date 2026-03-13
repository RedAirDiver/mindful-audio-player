import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 5;

function estimateMp3Duration(buffer: ArrayBuffer, totalFileSize: number): number | null {
  const view = new DataView(buffer);
  const bufSize = buffer.byteLength;

  let offset = 0;
  if (bufSize > 10 && view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
    const size = ((view.getUint8(6) & 0x7f) << 21) | ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) | (view.getUint8(9) & 0x7f);
    offset = 10 + size;
  }

  const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];

  for (let i = offset; i < Math.min(offset + 4096, bufSize - 4); i++) {
    if (view.getUint8(i) === 0xff && (view.getUint8(i + 1) & 0xe0) === 0xe0) {
      const header = view.getUint8(i + 1);
      const byte2 = view.getUint8(i + 2);
      const version = (header >> 3) & 0x03;
      const layer = (header >> 1) & 0x03;
      const bitrateIdx = (byte2 >> 4) & 0x0f;
      const sampleRateIdx = (byte2 >> 2) & 0x03;

      if (version === 3 && layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && sampleRateIdx < 3) {
        const bitrate = bitrateTable[bitrateIdx] * 1000;
        const audioDataSize = totalFileSize - i;
        return Math.round((audioDataSize * 8) / bitrate);
      }
    }
  }
  return null;
}

function estimateM4aDuration(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  const bufSize = buffer.byteLength;

  for (let i = 0; i < bufSize - 36; i++) {
    if (view.getUint8(i) === 0x6d && view.getUint8(i + 1) === 0x76 &&
        view.getUint8(i + 2) === 0x68 && view.getUint8(i + 3) === 0x64) {
      const version = view.getUint8(i + 4);
      let timescale: number, duration: number;
      if (version === 0) {
        timescale = view.getUint32(i + 16);
        duration = view.getUint32(i + 20);
      } else {
        timescale = view.getUint32(i + 24);
        duration = view.getUint32(i + 28) * 0x100000000 + view.getUint32(i + 32);
      }
      if (timescale > 0 && duration > 0) return Math.round(duration / timescale);
    }
  }
  return null;
}

function encodeStoragePath(path: string): string {
  return path.split("/").map((s) => encodeURIComponent(s)).join("/");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tracks, error: fetchError } = await supabase
      .from("audio_files")
      .select("id, file_path, title")
      .is("duration_seconds", null)
      .not("file_path", "like", "missing/%")
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;

    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({ message: "Klart", updated: 0, failed: 0, remaining: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { count: totalRemaining } = await supabase
      .from("audio_files")
      .select("id", { count: "exact", head: true })
      .is("duration_seconds", null)
      .not("file_path", "like", "missing/%");

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const track of tracks) {
      try {
        const isM4a = /\.(m4a|mp4|aac)$/i.test(track.file_path);
        const rangeBytes = isM4a ? 131072 : 65536;

        const storageUrl = `${SUPABASE_URL}/storage/v1/object/audio-files/${encodeStoragePath(track.file_path)}`;
        const response = await fetch(storageUrl, {
          headers: {
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
            "Range": `bytes=0-${rangeBytes - 1}`,
          },
        });

        if (!response.ok && response.status !== 206) {
          errors.push(`${track.title}: HTTP ${response.status}`);
          await response.text();
          failed++;
          // Mark as 0 so we don't loop on this file forever
          await supabase.from("audio_files").update({ duration_seconds: 0 }).eq("id", track.id);
          continue;
        }

        const contentRange = response.headers.get("Content-Range");
        const totalSize = contentRange ? parseInt(contentRange.split("/")[1]) : rangeBytes;

        const buffer = await response.arrayBuffer();
        let duration: number | null;

        if (isM4a) {
          duration = estimateM4aDuration(buffer);
        } else {
          duration = estimateMp3Duration(buffer, totalSize);
        }

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
          // Mark as 0 to prevent infinite loop
          await supabase.from("audio_files").update({ duration_seconds: 0 }).eq("id", track.id);
        }
      } catch (err) {
        errors.push(`${track.title}: ${String(err)}`);
        failed++;
        await supabase.from("audio_files").update({ duration_seconds: 0 }).eq("id", track.id);
      }
    }

    const remaining = (totalRemaining || 0) - updated - failed;

    return new Response(
      JSON.stringify({
        updated, failed, batch_size: tracks.length,
        remaining: Math.max(0, remaining),
        done: remaining <= 0,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
