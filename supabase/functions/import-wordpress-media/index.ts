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
  postParent: number | null;
  menuOrder: number;
}

function parseWordPressXml(xmlText: string): MediaItem[] {
  const items: MediaItem[] = [];

  // Match each <item> block
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const itemBlock = itemMatch[1];

    // Check if it's an audio attachment - handle both plain text and CDATA
    const attachmentType = itemBlock.match(/<wp:attachment_url>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:attachment_url>/);
    const postType = itemBlock.match(/<wp:post_type>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/wp:post_type>/);

    if (!attachmentType || (postType && postType[1] !== "attachment")) continue;

    const url = attachmentType[1].trim();
    if (!url.match(/\.(mp3|wav|m4a|mp4|ogg|flac)$/i)) continue;

    // Extract title - handle CDATA wrapping
    const titleMatch = itemBlock.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       itemBlock.match(/<title>(.*?)<\/title>/);
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
          // Parse serialized PHP to find length - try string format first, then integer format
          const lengthMatch = value.match(/s:6:"length";s:\d+:"(\d+)"/) ||
                              value.match(/s:6:"length";i:(\d+)/);
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

    // Extract post_parent (WooCommerce product ID)
    const postParentMatch = itemBlock.match(/<wp:post_parent>(\d+)<\/wp:post_parent>/);
    const postParent = postParentMatch ? parseInt(postParentMatch[1], 10) : null;

    // Extract menu_order for track ordering
    const menuOrderMatch = itemBlock.match(/<wp:menu_order>(\d+)<\/wp:menu_order>/);
    const menuOrder = menuOrderMatch ? parseInt(menuOrderMatch[1], 10) : 0;

    items.push({ title, url, duration, filename, postParent, menuOrder });
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

    // Debug logging
    console.log("XML length:", xmlText.length);
    console.log("First 500 chars:", xmlText.substring(0, 500));
    
    // Count raw <item> blocks
    const rawItemCount = (xmlText.match(/<item>/g) || []).length;
    console.log("Raw <item> blocks found:", rawItemCount);
    
    // Check for attachment URLs
    const attachmentUrlCount = (xmlText.match(/<wp:attachment_url>/g) || []).length;
    console.log("wp:attachment_url tags found:", attachmentUrlCount);
    
    // Log first few attachment URLs for debugging
    const sampleUrls: string[] = [];
    const itemRegexDebug = /<item>([\s\S]*?)<\/item>/g;
    let debugMatch;
    let debugCount = 0;
    while ((debugMatch = itemRegexDebug.exec(xmlText)) !== null && debugCount < 5) {
      const block = debugMatch[1];
      const attUrl = block.match(/<wp:attachment_url>(.*?)<\/wp:attachment_url>/);
      const postType = block.match(/<wp:post_type><!\[CDATA\[(.*?)\]\]><\/wp:post_type>/);
      if (attUrl) {
        sampleUrls.push(`URL: ${attUrl[1].trim()} | post_type: ${postType?.[1] || 'N/A'}`);
        debugCount++;
      }
    }
    console.log("Sample attachment URLs:", JSON.stringify(sampleUrls));

    const mediaItems = parseWordPressXml(xmlText);
    console.log("Parsed media items:", mediaItems.length);

    if (mediaItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "Inga ljudfiler hittades i XML-filen", total_in_xml: 0, durations_updated: 0, files_downloaded: 0, failed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all existing audio files to match by filename
    const { data: existingFiles } = await supabase
      .from("audio_files")
      .select("id, file_path, title, duration_seconds, program_id");

    // Get programs with wc_id for mapping unmatched files
    const { data: programs } = await supabase
      .from("programs")
      .select("id, wc_id, title");

    const wcIdToProgram = new Map<number, { id: string; title: string }>();
    programs?.forEach(p => {
      if (p.wc_id) wcIdToProgram.set(p.wc_id, { id: p.id, title: p.title });
    });

    let durationsUpdated = 0;
    let filesDownloaded = 0;
    let filesCreated = 0;
    let failed = 0;
    const results: { title: string; action: string; error?: string }[] = [];

    console.log("Existing DB files:", existingFiles?.length || 0, "Programs with wc_id:", wcIdToProgram.size);

    // Normalize filename: strip WordPress suffixes
    function normalizeFilename(name: string): string {
      return name
        .toLowerCase()
        .replace(/\.[^/.]+$/, "")
        .replace(/-\d+-[a-z0-9]+$/, "")
        .replace(/-\d+$/, "")
        .replace(/^\d+-/, "");
    }

    function normalizeTitle(t: string): string {
      return t.toLowerCase()
        .replace(/[åä]/g, "a").replace(/ö/g, "o")
        .replace(/[^a-z0-9]/g, "");
    }

    const dbNormalized = existingFiles?.map(f => ({
      ...f,
      normFilename: normalizeFilename(f.file_path.split("/").pop() || ""),
      normTitle: normalizeTitle(f.title),
    })) || [];

    // Track which programs already have tracks to determine next track_order
    const programTrackCounts = new Map<string, number>();
    existingFiles?.forEach(f => {
      const count = programTrackCounts.get(f.program_id) || 0;
      programTrackCounts.set(f.program_id, count + 1);
    });

    let unmatched = 0;
    let matched = 0;
    for (const item of mediaItems) {
      try {
        const xmlNormFilename = normalizeFilename(item.filename);
        const xmlNormTitle = normalizeTitle(item.title);

        // Try exact filename match first, then normalized, then title
        let matchingFile = dbNormalized.find(f => 
          f.file_path.split("/").pop()?.toLowerCase() === item.filename.toLowerCase()
        );
        if (!matchingFile) {
          matchingFile = dbNormalized.find(f => f.normFilename === xmlNormFilename && xmlNormFilename.length > 2);
        }
        if (!matchingFile) {
          matchingFile = dbNormalized.find(f => f.normTitle === xmlNormTitle && xmlNormTitle.length > 2);
        }

        if (!matchingFile) {
          // Try to create a new entry if we can map to a program via post_parent → wc_id
          if (item.postParent && wcIdToProgram.has(item.postParent)) {
            const program = wcIdToProgram.get(item.postParent)!;
            
            // Determine track order
            const currentCount = programTrackCounts.get(program.id) || 0;
            const trackOrder = item.menuOrder > 0 ? item.menuOrder : currentCount + 1;
            
            // Generate storage path
            const fileExt = item.filename.split(".").pop()?.toLowerCase() || "mp3";
            const contentType = fileExt === "mp3" ? "audio/mpeg" : fileExt === "mp4" || fileExt === "m4a" ? "audio/mp4" : `audio/${fileExt}`;
            const storageExt = fileExt === "mp4" ? "m4a" : fileExt; // normalize mp4 → m4a for storage
            const cleanFilename = item.filename.toLowerCase()
              .replace(/-\d+-[a-z0-9]+\./, ".") // remove WP suffix
              .replace(/-\d+\./, "."); // remove trailing number
            const storagePath = `audio/${item.postParent}/${cleanFilename}`;
            
            // Download from WordPress
            console.log(`Creating new + downloading: ${item.title} → ${program.title}`);
            const response = await fetch(item.url);
            if (!response.ok) {
              results.push({ title: item.title, action: "download_failed", error: `HTTP ${response.status}` });
              failed++;
              continue;
            }

            const blob = await response.blob();

            // Upload to storage
            const { error: uploadErr } = await supabase.storage
              .from("audio-files")
              .upload(storagePath, blob, {
                contentType,
                upsert: true,
              });

            if (uploadErr) {
              results.push({ title: item.title, action: "upload_failed", error: uploadErr.message });
              failed++;
              continue;
            }

            // Create DB entry
            const { data: insertedFile, error: insertErr } = await supabase
              .from("audio_files")
              .insert({
                title: item.title,
                file_path: storagePath,
                program_id: program.id,
                track_order: trackOrder,
                duration_seconds: item.duration,
              })
              .select("id")
              .single();

            if (insertErr) {
              results.push({ title: item.title, action: "insert_failed", error: insertErr.message });
              failed++;
            } else {
              // Also create junction table entry
              await supabase.from("program_audio_files").insert({
                program_id: program.id,
                audio_file_id: insertedFile.id,
                track_order: trackOrder,
              });
              filesCreated++;
              programTrackCounts.set(program.id, (programTrackCounts.get(program.id) || 0) + 1);
              results.push({ title: item.title, action: "created" });
            }
          } else {
            unmatched++;
            if (unmatched <= 5) console.log("No match & no program for:", item.filename, "postParent:", item.postParent, "title:", item.title);
          }
          continue;
        }

        matched++;
        if (matched <= 3) console.log("Matched:", item.filename, "→", matchingFile.file_path);

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

    console.log(`Summary: ${unmatched} unmatched, ${matched} matched, ${filesCreated} created, ${durationsUpdated} durations, ${filesDownloaded} downloaded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        total_in_xml: mediaItems.length,
        durations_updated: durationsUpdated,
        files_downloaded: filesDownloaded,
        files_created: filesCreated,
        unmatched,
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
