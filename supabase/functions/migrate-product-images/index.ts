import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch all programs with old WordPress image URLs
    const { data: programs, error } = await adminClient
      .from("programs")
      .select("id, title, image_url")
      .not("image_url", "is", null);

    if (error) throw error;

    const results: { id: string; title: string; status: string; new_url?: string; error?: string }[] = [];

    for (const program of programs || []) {
      if (!program.image_url) continue;

      // Skip if already migrated (points to supabase storage)
      if (program.image_url.includes("supabase.co")) {
        results.push({ id: program.id, title: program.title, status: "skipped", new_url: program.image_url });
        continue;
      }

      try {
        // Convert old URL to new domain
        let imageUrl = program.image_url;
        // Replace old domain with new one
        imageUrl = imageUrl.replace(
          /https?:\/\/xn--mentaltrning-ncb\.nu/,
          "http://test.unestalacademy.se"
        );
        // Also handle mentalträning.nu directly
        imageUrl = imageUrl.replace(
          /https?:\/\/mentalträning\.nu/,
          "http://test.unestalacademy.se"
        );

        console.log(`Downloading: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${imageUrl}`);
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Determine file extension
        let ext = "jpg";
        if (contentType.includes("png")) ext = "png";
        else if (contentType.includes("webp")) ext = "webp";
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";

        const filePath = `programs/${program.id}.${ext}`;

        // Upload to product-images bucket
        const { error: uploadError } = await adminClient.storage
          .from("product-images")
          .upload(filePath, uint8Array, {
            contentType,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = adminClient.storage
          .from("product-images")
          .getPublicUrl(filePath);

        const newUrl = urlData.publicUrl;

        // Update program record
        const { error: updateError } = await adminClient
          .from("programs")
          .update({ image_url: newUrl })
          .eq("id", program.id);

        if (updateError) throw updateError;

        results.push({ id: program.id, title: program.title, status: "migrated", new_url: newUrl });
        console.log(`✅ Migrated: ${program.title}`);
      } catch (err: any) {
        console.error(`❌ Failed: ${program.title}:`, err.message);
        results.push({ id: program.id, title: program.title, status: "failed", error: err.message });
      }
    }

    const migrated = results.filter(r => r.status === "migrated").length;
    const failed = results.filter(r => r.status === "failed").length;
    const skipped = results.filter(r => r.status === "skipped").length;

    return new Response(
      JSON.stringify({ 
        summary: { total: results.length, migrated, failed, skipped },
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Migration error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
