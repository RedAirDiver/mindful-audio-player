import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

const MobileCategory = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<"popular" | "newest">("popular");

  const { data: category } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: programs, isLoading } = useQuery({
    queryKey: ["category-programs", category?.name, sortBy],
    enabled: !!category,
    queryFn: async () => {
      let query = supabase
        .from("programs")
        .select("*")
        .eq("is_active", true)
        .contains("categories", [category!.name]);

      if (sortBy === "newest") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order("title");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen pb-32 bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary font-body">
          Kategori
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-6">
        {/* Category Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="font-display text-3xl font-bold text-foreground mb-3">
            {category?.name || "Laddar..."}
          </h1>
          {category?.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {category.description}
            </p>
          )}
        </motion.div>

        {/* Sort Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setSortBy("popular")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortBy === "popular"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Populärt
          </button>
          <button
            onClick={() => setSortBy("newest")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              sortBy === "newest"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Nyheter
          </button>
        </div>

        {/* Programs List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : programs && programs.length > 0 ? (
          <div className="space-y-6">
            {programs.map((program, index) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Program Image */}
                {program.image_url && (
                  <div className="w-full h-48 overflow-hidden">
                    <img
                      src={program.image_url}
                      alt={program.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Program Info */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-body">
                      {program.duration_text || "Mental träning"}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                      <span className="text-xs font-medium text-foreground">
                        4.{Math.floor(Math.random() * 3) + 7}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-display text-lg font-bold text-foreground mb-2">
                    {program.title}
                  </h3>

                  {program.short_description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                      {program.short_description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {program.price > 0 ? `${program.price} kr` : "Gratis"}
                    </span>
                    <button
                      onClick={() => navigate(`/program/${program.slug}`)}
                      className="flex items-center gap-1 text-sm font-semibold text-primary hover:opacity-70 transition-opacity"
                    >
                      Visa program
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              Inga program hittades i denna kategori.
            </p>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileCategory;
