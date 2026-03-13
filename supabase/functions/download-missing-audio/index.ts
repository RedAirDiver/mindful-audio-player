import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 1;

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
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

    // Find files with missing/ path that have a URL stored in description
    const { data: tracks, error: fetchError } = await supabase
      .from("audio_files")
      .select("id, file_path, title, description, program_id")
      .like("file_path", "missing/%")
      .not("description", "is", null)
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;

    if (!tracks || tracks.length === 0) {
      // Count total remaining missing
      const { count } = await supabase
        .from("audio_files")
        .select("id", { count: "exact", head: true })
        .like("file_path", "missing/%");

      return new Response(
        JSON.stringify({ done: true, downloaded: 0, failed: 0, remaining: count || 0, message: "Inga fler filer med URL att ladda ner" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count total remaining
    const { count: totalRemaining } = await supabase
      .from("audio_files")
      .select("id", { count: "exact", head: true })
      .like("file_path", "missing/%")
      .not("description", "is", null);

    let downloaded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const track of tracks) {
      const url = track.description;
      if (!url || !url.startsWith("http")) {
        // Not a URL, skip and clear description
        await supabase.from("audio_files").update({ description: null }).eq("id", track.id);
        failed++;
        continue;
      }

      try {
        console.log(`Downloading: ${track.title} from ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          errors.push(`${track.title}: HTTP ${response.status}`);
          failed++;
          await supabase.from("audio_files").update({ description: `download_failed_${response.status}` }).eq("id", track.id);
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

        // Stream upload directly via REST API to avoid buffering in memory
        const uploadUrl = `${supabaseUrl}/storage/v1/object/audio-files/${storagePath}`;
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": contentType,
            "x-upsert": "true",
          },
          body: response.body,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          errors.push(`${track.title}: Upload: ${errText}`);
          failed++;
          continue;
        }
        await uploadRes.text(); // consume response

        // Update DB: set real path, clear description (URL)
        const { error: updateErr } = await supabase
          .from("audio_files")
          .update({ file_path: storagePath, description: null })
          .eq("id", track.id);

        if (updateErr) {
          errors.push(`${track.title}: DB update: ${updateErr.message}`);
          failed++;
        } else {
          downloaded++;
        }
      } catch (err) {
        errors.push(`${track.title}: ${String(err)}`);
        failed++;
      }
    }

    const remaining = (totalRemaining || 0) - downloaded;

    return new Response(
      JSON.stringify({
        downloaded,
        failed,
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
