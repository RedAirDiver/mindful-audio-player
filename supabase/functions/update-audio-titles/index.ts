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

    const { xmlUrl, xmlContent: rawXml, storagePath, dryRun = true } = await req.json();

    let xmlContent = rawXml;
    if (storagePath && !xmlContent) {
      const { data, error: dlError } = await supabase.storage.from('audio-files').download(storagePath);
      if (dlError) throw dlError;
      xmlContent = await data.text();
      console.log('Downloaded from storage, length:', xmlContent.length);
    } else if (xmlUrl && !xmlContent) {
      const resp = await fetch(xmlUrl);
      xmlContent = await resp.text();
      console.log('Fetched XML length:', xmlContent.length);
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

    // Get all audio files with program wc_id
    const { data: audioFiles, error: audioError } = await supabase
      .from('audio_files')
      .select('id, title, file_path, program_id, programs!audio_files_program_id_fkey(wc_id)');

    if (audioError) throw audioError;

    // Build multiple lookup maps
    const filePathMap = new Map<string, { id: string; title: string; file_path: string; wc_id: number | null }>();
    const strippedMap = new Map<string, { id: string; title: string; file_path: string; wc_id: number | null }>();
    // Map by wc_id + normalized filename (without leading numbers and WP suffix)
    const wcIdFileMap = new Map<string, { id: string; title: string; file_path: string; wc_id: number | null }>();
    
    // Normalize: strip extension, leading track number, non-alpha. Do NOT strip WP suffix here.
    const normalizeBase = (fn: string) => fn
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')           // remove extension
      .replace(/^\d+[\.\-]\s*/, '')        // remove leading track number
      .replace(/[^a-z0-9]/g, '');          // only alphanumeric

    // Strip WP random suffix (5-8 chars that look random, not real words)
    const stripWpSuffix = (fn: string) => fn.replace(/-[a-z0-9]{5,8}(\.\w+)$/, '$1');

    for (const af of audioFiles || []) {
      const parts = af.file_path.split('/');
      const filename = parts[parts.length - 1].toLowerCase();
      const wc_id = (af as any).programs?.wc_id ?? null;
      const entry = { id: af.id, title: af.title, file_path: af.file_path, wc_id };
      
      filePathMap.set(filename, entry);
      
      // Stripped WP suffix version
      const stripped = stripWpSuffix(filename);
      if (stripped !== filename) {
        strippedMap.set(stripped, entry);
      }
      
      // wc_id + normalized filename key (DB files usually don't have WP suffix)
      if (wc_id) {
        const normKey = `${wc_id}:${normalizeBase(filename)}`;
        wcIdFileMap.set(normKey, entry);
      }
    }

    const stripSuffix = (fn: string) => fn.replace(/-[a-z0-9]{5,8}(\.\w+)$/, '$1');

    const updates: Array<{ audioId: string; oldTitle: string; newTitle: string; filePath: string; productTitle: string; matchMethod: string }> = [];
    const notFound: Array<{ filename: string; expectedName: string; productId: string }> = [];

    for (const post of posts) {
      for (let i = 0; i < post.paths.length && i < post.names.length; i++) {
        const url = post.paths[i].trim();
        const newName = post.names[i].trim();

        const urlParts = url.split('/');
        const urlFilename = urlParts[urlParts.length - 1].toLowerCase();

        // Try exact match
        let audioFile = filePathMap.get(urlFilename);
        let matchMethod = 'exact';
        
        // Try stripped WP suffix
        if (!audioFile) {
          const strippedUrl = stripSuffix(urlFilename);
          audioFile = strippedMap.get(strippedUrl) || filePathMap.get(strippedUrl);
          matchMethod = 'stripped';
        }
        
        // Try wc_id + normalized filename
        if (!audioFile && post.id) {
          const normKey = `${post.id}:${normalizeForMatch(urlFilename)}`;
          audioFile = wcIdFileMap.get(normKey);
          matchMethod = 'wcid_norm';
        }

        if (audioFile) {
          const isDifferent = audioFile.title !== newName;
          if (isDifferent) {
            updates.push({
              audioId: audioFile.id,
              oldTitle: audioFile.title,
              newTitle: newName,
              filePath: audioFile.file_path,
              productTitle: post.title,
              matchMethod,
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
