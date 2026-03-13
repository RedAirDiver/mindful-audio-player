import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanTitle(filename: string): string {
  // Remove extension
  let name = filename.replace(/\.[^/.]+$/, "");
  // Remove WP hash suffix like "-lrezn5"
  name = name.replace(/-[a-z0-9]{4,8}$/, "");
  // Remove leading track number like "01-" or "1-"
  name = name.replace(/^\d+[-_.\s]+/, "");
  // Replace hyphens/underscores with spaces
  name = name.replace(/[-_]+/g, " ");
  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return name.trim();
}

function extractTrackOrder(filename: string): number {
  const match = filename.match(/^(\d+)[-_.\s]/);
  return match ? parseInt(match[1]) : 1;
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

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    // Get all programs (for wc_id mapping)
    const { data: programs } = await supabase
      .from("programs")
      .select("id, wc_id, title");

    const programsByWcId = new Map<number, any>();
    const programsById = new Map<string, any>();
    for (const p of programs || []) {
      if (p.wc_id) programsByWcId.set(p.wc_id, p);
      programsById.set(p.id, p);
    }

    // List all files in storage bucket
    // Storage is organized in folders, list top-level first
    const { data: topFolders, error: listErr } = await supabase.storage
      .from("audio-files")
      .list("", { limit: 1000 });

    if (listErr) {
      return new Response(JSON.stringify({ error: "Could not list storage: " + listErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect all files with their paths
    const allFiles: { path: string; programId: string | null; title: string; trackOrder: number }[] = [];

    for (const item of topFolders || []) {
      if (!item.id) {
        // It's a folder — list contents
        const folderName = item.name;
        
        // Check if it's "audio" folder (contains wc_id subfolders)
        if (folderName === "audio") {
          const { data: wcFolders } = await supabase.storage
            .from("audio-files")
            .list("audio", { limit: 1000 });

          for (const wcFolder of wcFolders || []) {
            if (!wcFolder.id) {
              // It's a wc_id subfolder
              const wcId = parseInt(wcFolder.name);
              const program = wcId ? programsByWcId.get(wcId) : null;

              const { data: audioFilesInFolder } = await supabase.storage
                .from("audio-files")
                .list(`audio/${wcFolder.name}`, { limit: 1000 });

              // Group by clean name to deduplicate (prefer clean over hash-suffix)
              const byCleanName = new Map<string, { path: string; hasHash: boolean }>();
              
              for (const f of audioFilesInFolder || []) {
                if (!f.name || !f.id) continue;
                const path = `audio/${wcFolder.name}/${f.name}`;
                const cleanName = f.name.replace(/-[a-z0-9]{4,8}(\.\w+)$/, "$1").toLowerCase();
                const hasHash = cleanName !== f.name.toLowerCase();

                const existing = byCleanName.get(cleanName);
                if (!existing || (existing.hasHash && !hasHash)) {
                  // Prefer the non-hash version
                  byCleanName.set(cleanName, { path, hasHash });
                }
              }

              for (const [, entry] of byCleanName) {
                const filename = entry.path.split("/").pop() || "";
                allFiles.push({
                  path: entry.path,
                  programId: program?.id || null,
                  title: cleanTitle(filename),
                  trackOrder: extractTrackOrder(filename),
                });
              }
            }
          }
        } else {
          // It's a program UUID folder
          const program = programsById.get(folderName);

          const { data: filesInFolder } = await supabase.storage
            .from("audio-files")
            .list(folderName, { limit: 1000 });

          for (const f of filesInFolder || []) {
            if (!f.name || !f.id) continue;
            const path = `${folderName}/${f.name}`;
            allFiles.push({
              path,
              programId: program?.id || folderName,
              title: cleanTitle(f.name),
              trackOrder: extractTrackOrder(f.name),
            });
          }
        }
      }
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          totalFiles: allFiles.length,
          preview: allFiles.slice(0, 50).map(f => ({
            path: f.path,
            title: f.title,
            programId: f.programId,
            trackOrder: f.trackOrder,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create audio_files records
    let created = 0;
    let linked = 0;
    let failed = 0;

    for (const file of allFiles) {
      const { data: newAudio, error: insertErr } = await supabase
        .from("audio_files")
        .insert({
          title: file.title,
          file_path: file.path,
          program_id: file.programId,
          track_order: file.trackOrder,
        })
        .select("id")
        .single();

      if (insertErr) {
        failed++;
        continue;
      }
      created++;

      // Create program_audio_files link
      if (file.programId) {
        const { error: linkErr } = await supabase
          .from("program_audio_files")
          .insert({
            program_id: file.programId,
            audio_file_id: newAudio.id,
            track_order: file.trackOrder,
          });
        if (!linkErr) linked++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalFiles: allFiles.length,
        created,
        linked,
        failed,
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
