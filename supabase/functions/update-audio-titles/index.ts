import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { xmlUrl, xmlContent: rawXml, dryRun = true } = await req.json();

    let xmlContent = rawXml;
    if (xmlUrl && !xmlContent) {
      const resp = await fetch(xmlUrl);
      xmlContent = await resp.text();
      console.log('Fetched XML length:', xmlContent.length, 'First 100 chars:', xmlContent.substring(0, 100));
    }

    if (!xmlContent) {
      return new Response(JSON.stringify({ error: 'xmlContent or xmlUrl is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Strip BOM and normalize
    xmlContent = xmlContent.replace(/^\uFEFF/, '').replace(/^\xEF\xBB\xBF/, '');

    // Parse XML posts
    const postRegex = /<post>([\s\S]*?)<\/post>/g;
    const posts: Array<{ id: string; title: string; paths: string[]; names: string[] }> = [];

    let match;
    while ((match = postRegex.exec(xmlContent)) !== null) {
      const postContent = match[1];

      const getId = (tag: string) => {
        // Handle CDATA
        const cdataMatch = postContent.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
        if (cdataMatch) return cdataMatch[1].trim();
        const normalMatch = postContent.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
        return normalMatch ? normalMatch[1].trim() : '';
      };

      const id = getId('ID');
      const title = getId('Title');
      const downloadPaths = getId('DownloadableFilesPaths');
      const downloadNames = getId('DownloadableFilesNames');

      if (downloadPaths && downloadNames) {
        const paths = downloadPaths.split('|').filter(p => p.trim());
        const names = downloadNames.split('|').filter(n => n.trim());
        posts.push({ id, title, paths, names });
      }
    }

    // Get all audio files
    const { data: audioFiles, error: audioError } = await supabase
      .from('audio_files')
      .select('id, title, file_path');

    if (audioError) throw audioError;

    // Build filename -> audio_file mapping
    const filePathMap = new Map<string, { id: string; title: string; file_path: string }>();
    for (const af of audioFiles || []) {
      // Extract filename from file_path like "audio/5418/filename.mp3"
      const parts = af.file_path.split('/');
      const filename = parts[parts.length - 1].toLowerCase();
      filePathMap.set(filename, af);
    }

    const updates: Array<{ audioId: string; oldTitle: string; newTitle: string; filePath: string; productTitle: string }> = [];
    const notFound: Array<{ filename: string; expectedName: string; productId: string }> = [];

    for (const post of posts) {
      for (let i = 0; i < post.paths.length && i < post.names.length; i++) {
        const url = post.paths[i].trim();
        const newName = post.names[i].trim();

        // Extract filename from URL
        const urlParts = url.split('/');
        const urlFilename = urlParts[urlParts.length - 1].toLowerCase();

        const audioFile = filePathMap.get(urlFilename);

        if (audioFile) {
          // Check if title actually needs updating (skip if already correct)
          // A title needs updating if it looks like a hash or generic "Spår X"
          const currentTitle = audioFile.title;
          const isHash = /^[a-f0-9]{40,}/.test(currentTitle);
          const isGenericTrack = /^(Spår \d+|[0-9]+[\.\-])/i.test(currentTitle);
          const isFilename = currentTitle.includes('.mp3') || currentTitle.includes('.mp4') || currentTitle.includes('.m4a');
          const isDifferent = currentTitle !== newName;

          if (isDifferent) {
            updates.push({
              audioId: audioFile.id,
              oldTitle: currentTitle,
              newTitle: newName,
              filePath: audioFile.file_path,
              productTitle: post.title,
            });
          }
        } else {
          notFound.push({
            filename: urlFilename,
            expectedName: newName,
            productId: post.id,
          });
        }
      }
    }

    if (!dryRun) {
      // Apply updates in batches
      let updatedCount = 0;
      for (const update of updates) {
        const { error } = await supabase
          .from('audio_files')
          .update({ title: update.newTitle })
          .eq('id', update.audioId);

        if (!error) updatedCount++;
      }

      return new Response(JSON.stringify({
        success: true,
        updatedCount,
        totalMatched: updates.length,
        notFoundCount: notFound.length,
        sampleUpdates: updates.slice(0, 10),
        sampleNotFound: notFound.slice(0, 10),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      dryRun: true,
      postsFound: posts.length,
      totalMatched: updates.length,
      notFoundCount: notFound.length,
      updates: updates,
      notFound: notFound.slice(0, 20),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
