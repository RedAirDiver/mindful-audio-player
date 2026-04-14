const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsArticle {
  title: string;
  summary: string;
  url: string | null;
  imageUrl: string | null;
  categories: string[];
}

function parseArticles(html: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  // Match each <article> block
  const articleRegex = /<article[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const classes = match[1];
    const content = match[2];

    // Extract categories from classes like "category-nyheter category-artiklar"
    const cats: string[] = [];
    const catRegex = /category-(\S+)/g;
    let catMatch;
    while ((catMatch = catRegex.exec(classes)) !== null) {
      cats.push(catMatch[1]);
    }

    // Extract summary text from entry-summary
    const summaryMatch = content.match(/<div class="entry-summary">\s*([\s\S]*?)\s*<\/div>/);
    let summary = '';
    if (summaryMatch) {
      // Strip HTML tags but keep text
      summary = summaryMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Skip empty articles
    if (!summary) continue;

    // Extract "Läs mer" link
    const linkMatch = content.match(/href="(https:\/\/www\.unestaleducation\.se\/[^"]+)"/);
    const url = linkMatch ? linkMatch[1] : null;

    // Extract image
    const imgMatch = content.match(/src="(https:\/\/www\.unestaleducation\.se\/wp-content\/[^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    // Extract title from <a title="...">
    const titleMatch = content.match(/title="([^"]+)"/);

    // Try to create a meaningful title from the summary
    let title = titleMatch ? titleMatch[1] : '';
    if (!title) {
      // Use first sentence or first ~60 chars as title
      const firstSentence = summary.match(/^[^.!?]+[.!?]/);
      title = firstSentence ? firstSentence[0] : summary.substring(0, 80) + '…';
    }

    articles.push({ title, summary, url, imageUrl, categories: cats });
  }

  return articles;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1 } = await req.json().catch(() => ({ page: 1 }));

    const pageUrl = page > 1
      ? `https://www.unestaleducation.se/aktuellt/page/${page}/`
      : 'https://www.unestaleducation.se/aktuellt/';

    console.log('Fetching news from:', pageUrl);

    const response = await fetch(pageUrl, {
      headers: { 'User-Agent': 'UnestålApp/1.0' },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    const articles = parseArticles(html);

    // Check if there's a next page
    const hasNextPage = html.includes(`/aktuellt/page/${page + 1}/`);

    console.log(`Parsed ${articles.length} articles from page ${page}`);

    return new Response(
      JSON.stringify({ success: true, articles, page, hasNextPage }),
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
