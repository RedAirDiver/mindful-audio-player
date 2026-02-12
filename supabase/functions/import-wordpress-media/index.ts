import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MediaItem {
  title: string;
  url: string;
  duration: number | null;
  filename: string;
}

function parseWordPressXml(xmlText: string): MediaItem[] {
  const items: MediaItem[] = [];

  // Match each <item> block
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const itemBlock = itemMatch[1];

    // Check if it's an audio attachment
    const attachmentType = itemBlock.match(/<wp:attachment_url>(.*?)<\/wp:attachment_url>/);
    const postType = itemBlock.match(/<wp:post_type><!\[CDATA\[(.*?)\]\]><\/wp:post_type>/);

    if (!attachmentType || (postType && postType[1] !== "attachment")) continue;

    const url = attachmentType[1].trim();
    if (!url.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) continue;

    // Extract title
    const titleMatch = itemBlock.match(/<title>(.*?)<\/title>/) ||
                       itemBlock.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract duration from wp:meta
    let duration: number | null = null;
    const metaRegex = /<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g;
    let metaMatch;
    while ((metaMatch = metaRegex.exec(itemBlock)) !== null) {
      const metaBlock = metaMatch[1];
      const keyMatch = metaBlock.match(/<wp:meta_key><!\[CDATA\[(.*?)\]\]><\/wp:meta_key>/);
      const valueMatch = metaBlock.match(/<wp:meta_value><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_value>/);

      if (keyMatch && valueMatch) {
        const key = keyMatch[1];
        const value = valueMatch[1];

        if (key === "_wp_attachment_metadata") {
          // Parse serialized PHP to find length
          const lengthMatch = value.match(/s:6:"length";s:\d+:"(\d+)"/);
          if (lengthMatch) {
            duration = parseInt(lengthMatch[1], 10);
          }
          // Also try length_formatted -> convert to seconds
          if (!duration) {
            const formattedMatch = value.match(/s:16:"length_formatted";s:\d+:"(\d+):(\d+)"/);
            if (formattedMatch) {
              duration = parseInt(formattedMatch[1], 10) * 60 + parseInt(formattedMatch[2], 10);
            }
          }
        }
      }
    }

    const filename = url.split("/").pop() || "";

    items.push({ title, url, duration, filename });
  }

  return items;
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

    const contentType = req.headers.get("content-type") || "";
    let xmlText: string;
    let mode: "duration_only" | "full" = "full";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return new Response(JSON.stringify({ error: "No file provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      xmlText = await file.text();
      mode = (formData.get("mode") as string) === "duration_only" ? "duration_only" : "full";
    } else {
      const body = await req.json();
      xmlText = body.xml;
      mode = body.mode || "full";
    }

    const mediaItems = parseWordPressXml(xmlText);

    if (mediaItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "Inga ljudfiler hittades i XML-filen", updated: 0, downloaded: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all existing audio files to match by filename
    const { data: existingFiles } = await supabase
      .from("audio_files")
      .select("id, file_path, title, duration_seconds");

    let durationsUpdated = 0;
    let filesDownloaded = 0;
    let failed = 0;
    const results: { title: string; action: string; error?: string }[] = [];

    for (const item of mediaItems) {
      try {
        // Try to match with existing db records by filename
        const matchingFile = existingFiles?.find((f) => {
          const dbFilename = f.file_path.split("/").pop()?.toLowerCase();
          return dbFilename === item.filename.toLowerCase();
        });

        // Update duration if we have a match and duration is missing
        if (matchingFile && item.duration && !matchingFile.duration_seconds) {
          const { error: updateErr } = await supabase
            .from("audio_files")
            .update({ duration_seconds: item.duration })
            .eq("id", matchingFile.id);

          if (updateErr) {
            results.push({ title: item.title, action: "duration_error", error: updateErr.message });
            failed++;
          } else {
            durationsUpdated++;
            results.push({ title: item.title, action: "duration_updated" });
          }
        }

        // Download and upload file if mode is full
        if (mode === "full" && matchingFile) {
          // Check if file already exists in storage
          const { data: existingStorageFile } = await supabase.storage
            .from("audio-files")
            .createSignedUrl(matchingFile.file_path, 10);

          if (existingStorageFile?.signedUrl) {
            // File already exists, skip
            if (!item.duration || matchingFile.duration_seconds) {
              results.push({ title: item.title, action: "already_exists" });
            }
            continue;
          }

          // Download from WordPress
          console.log(`Downloading: ${item.url}`);
          const response = await fetch(item.url);
          if (!response.ok) {
            results.push({ title: item.title, action: "download_failed", error: `HTTP ${response.status}` });
            failed++;
            continue;
          }

          const blob = await response.blob();

          // Upload to storage using the existing file_path from the database
          const { error: uploadErr } = await supabase.storage
            .from("audio-files")
            .upload(matchingFile.file_path, blob, {
              contentType: "audio/mpeg",
              upsert: true,
            });

          if (uploadErr) {
            results.push({ title: item.title, action: "upload_failed", error: uploadErr.message });
            failed++;
          } else {
            filesDownloaded++;
            results.push({ title: item.title, action: "downloaded" });
          }
        }
      } catch (err) {
        results.push({ title: item.title, action: "error", error: String(err) });
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        total_in_xml: mediaItems.length,
        durations_updated: durationsUpdated,
        files_downloaded: filesDownloaded,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
