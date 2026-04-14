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
  
  // Split by article tags more reliably
  const parts = html.split(/<article\b/);
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const closeIdx = part.indexOf('</article>');
    if (closeIdx === -1) continue;
    
    const fullTag = '<article' + part.substring(0, closeIdx);
    
    // Extract classes
    const classMatch = fullTag.match(/class="([^"]*)"/);
    const classes = classMatch ? classMatch[1] : '';
    
    // Extract categories
    const cats: string[] = [];
    const catRegex = /category-(\S+)/g;
    let catMatch;
    while ((catMatch = catRegex.exec(classes)) !== null) {
      cats.push(catMatch[1]);
    }

    // Extract all text from entry-summary - get everything between entry-summary div tags
    const summaryStart = fullTag.indexOf('entry-summary');
    if (summaryStart === -1) continue;
    
    // Find the content after entry-summary div opening
    const afterSummary = fullTag.substring(summaryStart);
    const firstClose = afterSummary.indexOf('>');
    const contentAfter = afterSummary.substring(firstClose + 1);
    
    // Get all paragraph text
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(contentAfter)) !== null) {
      const text = pMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (text && !text.startsWith('Läs mer')) {
        paragraphs.push(text);
      }
    }
    
    const summary = paragraphs.join(' ').trim();
    if (!summary || summary.length < 10) continue;

    // Extract all links from the article
    const allLinks: string[] = [];
    const linkRegex = /href="(https:\/\/www\.unestaleducation\.se\/[^"]+)"/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(fullTag)) !== null) {
      allLinks.push(linkMatch[1]);
    }
    const url = allLinks[0] || null;

    // Extract image
    const imgMatch = fullTag.match(/src="(https:\/\/[^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    // Extract title from <a title="...">
    const titleMatch = fullTag.match(/title="([^"]+)"/);
    let title = titleMatch ? titleMatch[1].replace(/&#8211;/g, '–').replace(/&#8217;/g, "'") : '';
    if (!title) {
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
