const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  categories: string[];
  date: string;
  author: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1 } = await req.json().catch(() => ({ page: 1 }));
    const perPage = 10;

    const apiUrl = `https://www.unestaleducation.se/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed`;
    console.log('Fetching news from WP API:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'UnestålApp/1.0' },
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 400) {
        // Beyond last page
        return new Response(
          JSON.stringify({ success: true, articles: [], page, hasNextPage: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `WP API error: ${status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
    const posts = await response.json();

    const articles: NewsArticle[] = posts.map((post: any) => {
      // Clean excerpt HTML
      const rawExcerpt = post.excerpt?.rendered || '';
      const summary = rawExcerpt
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8230;/g, '…')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      // Clean title
      const title = (post.title?.rendered || '')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&amp;/g, '&');

      // Embedded data
      const embedded = post._embedded || {};

      // Author
      const authorData = embedded.author?.[0];
      const author = authorData?.name || null;

      // Featured image
      const media = embedded['wp:featuredmedia']?.[0];
      const imageUrl = media?.source_url || media?.media_details?.sizes?.medium?.source_url || null;

      // Categories
      const terms = embedded['wp:term']?.[0] || [];
      const categories = terms
        .filter((t: any) => typeof t === 'object' && t.name)
        .map((t: any) => t.name as string);

      return {
        title,
        summary,
        url: post.link,
        imageUrl,
        categories,
        date: post.date,
        author,
      };
    }).filter((a: NewsArticle) => a.summary.length > 5);

    console.log(`Parsed ${articles.length} articles from page ${page}/${totalPages}`);

    return new Response(
      JSON.stringify({ success: true, articles, page, hasNextPage: page < totalPages }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching news:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
