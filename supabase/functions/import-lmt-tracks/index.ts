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

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { xmlContent, dryRun = true } = await req.json();

    if (!xmlContent) {
      return new Response(JSON.stringify({ error: 'xmlContent is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get LMT program
    const { data: program } = await supabase
      .from('programs')
      .select('id, title, wc_id')
      .eq('wc_id', 5418)
      .single();

    if (!program) {
      return new Response(JSON.stringify({ error: 'LMT program (wc_id 5418) not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing audio files for this program
    const { data: existingFiles } = await supabase
      .from('audio_files')
      .select('id, file_path, title, track_order')
      .eq('program_id', program.id);

    const existingFilenames = new Set(
      (existingFiles || []).map(f => f.file_path.split('/').pop()!.toLowerCase())
    );

    // Also build a set of hash bases (without WP suffix) for matching
    const existingHashBases = new Set<string>();
    for (const f of existingFiles || []) {
      const fn = f.file_path.split('/').pop()!;
      // Extract hash base: remove extension and WP suffix like -swio4z
      const base = fn.replace(/\.[^/.]+$/, '').replace(/-[a-z0-9]{5,8}$/, '');
      existingHashBases.add(base.toLowerCase());
    }

    console.log(`Existing files: ${existingFilenames.size}, hash bases: ${existingHashBases.size}`);

    // Parse XML - find the LMT post (the one with hash-based filenames)
    const postRegex = /<post>([\s\S]*?)<\/post>/g;
    let lmtPost: { titles: string[]; urls: string[]; filenames: string[] } | null = null;

    let match;
    while ((match = postRegex.exec(xmlContent)) !== null) {
      const block = match[1];
      const urlMatch = block.match(/<AttachmentURL>([\s\S]*?)<\/AttachmentURL>/);
      const titleMatch = block.match(/<AttachmentTitle>([\s\S]*?)<\/AttachmentTitle>/);
      const fnMatch = block.match(/<AttachmentFilename>([\s\S]*?)<\/AttachmentFilename>/);

      if (!urlMatch || !urlMatch[1].trim()) continue;

      const urls = urlMatch[1].split('|').filter(u => u.trim());
      const titles = titleMatch ? titleMatch[1].split('|').filter(t => t.trim()) : [];
      const filenames = fnMatch ? fnMatch[1].split('|').filter(f => f.trim()) : [];

      // Identify LMT post: check if any URL filename matches our existing hash files
      for (const url of urls) {
        const fn = url.split('/').pop()!.toLowerCase();
        if (existingFilenames.has(fn)) {
          lmtPost = { titles, urls, filenames };
          break;
        }
        // Also try hash base match
        const base = fn.replace(/\.[^/.]+$/, '').replace(/-[a-z0-9]{5,8}$/, '');
        if (existingHashBases.has(base)) {
          lmtPost = { titles, urls, filenames };
          break;
        }
      }
      if (lmtPost) break;
    }

    if (!lmtPost) {
      return new Response(JSON.stringify({ error: 'Could not find LMT post in XML' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found LMT post with ${lmtPost.urls.length} URLs, ${lmtPost.titles.length} titles`);

    // Find missing files
    const missing: Array<{ url: string; title: string; filename: string; index: number }> = [];
    const alreadyExists: string[] = [];

    for (let i = 0; i < lmtPost.urls.length; i++) {
      const url = lmtPost.urls[i].trim();
      const urlFilename = url.split('/').pop()!.toLowerCase();
      const title = i < lmtPost.titles.length ? lmtPost.titles[i].trim() : '';
      const filename = i < lmtPost.filenames.length ? lmtPost.filenames[i].trim() : urlFilename;

      // Check if already exists
      if (existingFilenames.has(urlFilename)) {
        alreadyExists.push(urlFilename);
        continue;
      }

      // Check hash base match
      const base = urlFilename.replace(/\.[^/.]+$/, '').replace(/-[a-z0-9]{5,8}$/, '');
      if (existingHashBases.has(base)) {
        alreadyExists.push(urlFilename);
        continue;
      }

      missing.push({ url, title, filename, index: i });
    }

    console.log(`Already exists: ${alreadyExists.length}, Missing: ${missing.length}`);

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        programTitle: program.title,
        totalInXml: lmtPost.urls.length,
        alreadyExists: alreadyExists.length,
        missing: missing.length,
        missingFiles: missing.map(m => ({
          filename: m.filename,
          title: m.title,
          index: m.index,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download and import missing files
    const maxTrackOrder = Math.max(0, ...(existingFiles || []).map(f => f.track_order));
    let created = 0;
    let failed = 0;
    const results: Array<{ filename: string; action: string; error?: string }> = [];

    for (const item of missing) {
      try {
        const ext = item.filename.split('.').pop()?.toLowerCase() || 'mp4';
        const storageExt = ext === 'mp4' ? 'm4a' : ext;
        const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
        
        // Clean filename for storage
        const cleanFilename = item.filename.toLowerCase()
          .replace(/-[a-z0-9]{5,8}\./, '.');
        const storagePath = `audio/5418/${cleanFilename.endsWith(`.${storageExt}`) ? cleanFilename : cleanFilename.replace(/\.[^/.]+$/, `.${storageExt}`)}`;

        console.log(`Downloading: ${item.url.substring(0, 80)}...`);
        const response = await fetch(item.url);
        if (!response.ok) {
          results.push({ filename: item.filename, action: 'download_failed', error: `HTTP ${response.status}` });
          failed++;
          continue;
        }

        const blob = await response.blob();

        const { error: uploadErr } = await supabase.storage
          .from('audio-files')
          .upload(storagePath, blob, { contentType, upsert: true });

        if (uploadErr) {
          results.push({ filename: item.filename, action: 'upload_failed', error: uploadErr.message });
          failed++;
          continue;
        }

        const trackOrder = maxTrackOrder + created + 1;
        const title = item.title || item.filename.replace(/\.[^/.]+$/, '');

        const { data: inserted, error: insertErr } = await supabase
          .from('audio_files')
          .insert({
            title,
            file_path: storagePath,
            program_id: program.id,
            track_order: trackOrder,
          })
          .select('id')
          .single();

        if (insertErr) {
          results.push({ filename: item.filename, action: 'insert_failed', error: insertErr.message });
          failed++;
          continue;
        }

        // Also create junction table entry
        await supabase.from('program_audio_files').insert({
          program_id: program.id,
          audio_file_id: inserted.id,
          track_order: trackOrder,
        });

        created++;
        results.push({ filename: item.filename, action: 'created' });
      } catch (err) {
        results.push({ filename: item.filename, action: 'error', error: String(err) });
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      programTitle: program.title,
      totalInXml: lmtPost.urls.length,
      alreadyExists: alreadyExists.length,
      created,
      failed,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
