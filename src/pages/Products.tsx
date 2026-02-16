import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProgramCard from "@/components/ProgramCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface Program {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  image_url: string | null;
  duration_text: string | null;
  categories: string[] | null;
}

const Products = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [categories, setCategories] = useState<{ name: string }[]>([]);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedCategory = searchParams.get("kategori") || "all";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [programsRes, categoriesRes] = await Promise.all([
        supabase.from("programs").select("*").eq("is_active", true).order("title"),
        supabase.from("categories").select("name").order("sort_order"),
      ]);

      if (programsRes.error) throw programsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const progs = programsRes.data || [];
      setPrograms(progs);
      setCategories(categoriesRes.data || []);

      // Fetch track counts
      if (progs.length > 0) {
        const { data: audioData } = await supabase
          .from("audio_files")
          .select("program_id")
          .in("program_id", progs.map((p) => p.id));

        if (audioData) {
          const counts: Record<string, number> = {};
          audioData.forEach((a) => {
            counts[a.program_id] = (counts[a.program_id] || 0) + 1;
          });
          setTrackCounts(counts);
        }
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (cat: string) => {
    if (cat === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ kategori: cat });
    }
  };

  // Filter out meta-categories like "Populära Produkter" from the filter UI
  const displayCategories = categories.filter(
    (c) => c.name !== "Populära Produkter"
  );

  const filteredPrograms = programs.filter((p) => {
    if (selectedCategory === "all") return true;
    return p.categories?.includes(selectedCategory);
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              Alla produkter
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Utforska våra professionellt framtagna program för mental träning och avslappning.
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryChange("all")}
              className="rounded-full"
            >
              Alla
            </Button>
            {displayCategories.map((cat) => (
              <Button
                key={cat.name}
                variant={selectedCategory === cat.name ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategoryChange(cat.name)}
                className="rounded-full"
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-96 rounded-2xl" />
              ))}
            </div>
          )}

          {/* Products Grid */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPrograms.map((program, index) => (
                <div
                  key={program.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ProgramCard
                    slug={program.slug}
                    title={program.title}
                    description={program.short_description || program.description || ""}
                    duration={program.duration_text || ""}
                    trackCount={trackCounts[program.id] || 0}
                    price={program.price}
                    image={program.image_url || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop"}
                    categories={program.categories || []}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredPrograms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Inga produkter hittades i denna kategori.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Products;
