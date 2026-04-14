import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "motion/react";
import { ExternalLink, Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

interface NewsArticle {
  title: string;
  summary: string;
  url: string | null;
  imageUrl: string | null;
  categories: string[];
  date: string;
  author: string | null;
}

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
};

const MobileNews = () => {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mobile-news", page],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-news", {
        body: { page },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data as { articles: NewsArticle[]; page: number; hasNextPage: boolean };
    },
    staleTime: 10 * 60 * 1000, // 10 min cache
  });

  return (
    <div className="min-h-screen pb-32 bg-background">
      <MobileHeader />

      <main className="max-w-2xl mx-auto px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-5"
        >
          <Newspaper className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">
            Aktuellt
          </h1>
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-16">
            <p className="text-destructive text-sm">
              Kunde inte hämta nyheter. Försök igen senare.
            </p>
          </div>
        )}

        {/* Articles */}
        {data?.articles && (
          <div className="space-y-4">
            {data.articles.map((article, index) => (
              <motion.article
                key={index}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                {article.imageUrl && (
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-4">
                  {/* Categories */}
                  {article.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {article.categories.map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <h2 className="font-display text-base font-semibold text-foreground mb-1 line-clamp-2">
                    {article.title}
                  </h2>

                  {/* Date & Author */}
                  <p className="text-xs text-muted-foreground mb-2">
                    Publicerat {formatDate(article.date)}
                    {article.author && <> av <span className="font-medium text-foreground/70">{article.author}</span></>}
                  </p>

                  {/* Summary */}
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {article.summary}
                  </p>

                  {/* Read more link */}
                  {article.url && (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Läs mer
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {/* Empty state */}
        {data?.articles?.length === 0 && (
          <div className="text-center py-16">
            <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Inga nyheter hittades.</p>
          </div>
        )}

        {/* Pagination */}
        {data && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Föregående
            </Button>
            <span className="text-sm text-muted-foreground">Sida {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full"
            >
              Nästa
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileNews;
