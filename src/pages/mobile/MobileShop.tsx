import { useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import ProgramCard from "@/components/ProgramCard";
import { Skeleton } from "@/components/ui/skeleton";

const countryLabels: Record<string, string> = {
  EN: "🇬🇧 English",
  FI: "🇫🇮 Finska",
  NO: "🇳🇴 Norska",
  DK: "🇩🇰 Danska",
  DE: "🇩🇪 Deutsch",
  ES: "🇪🇸 Español",
  FR: "🇫🇷 Français",
  PT: "🇵🇹 Português",
  IT: "🇮🇹 Italiano",
  NL: "🇳🇱 Nederlands",
  PL: "🇵🇱 Polski",
  RU: "🇷🇺 Русский",
  ZH: "🇨🇳 中文",
  JA: "🇯🇵 日本語",
  KO: "🇰🇷 한국어",
  AR: "🇸🇦 العربية",
  HI: "🇮🇳 Hindi",
};

const MobileShop = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (deltaX > 100 && deltaY < 80) navigate(-1);
  };

  const selectedCategory = searchParams.get("kategori") || "all";
  const selectedLanguage = searchParams.get("sprak") || "all";

  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ["mobile-shop-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["mobile-shop-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name, is_hidden")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: trackCounts = {} } = useQuery({
    queryKey: ["mobile-shop-tracks", programs.map((p) => p.id)],
    enabled: programs.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("audio_files")
        .select("program_id")
        .in("program_id", programs.map((p) => p.id));
      const counts: Record<string, number> = {};
      data?.forEach((a) => {
        counts[a.program_id!] = (counts[a.program_id!] || 0) + 1;
      });
      return counts;
    },
  });

  const displayCategories = categories.filter(
    (c) => !c.is_hidden && c.name !== "Populära Produkter" && c.name !== "Dolda"
  );

  const availableLanguages = useMemo(() => {
    const foreign = programs.filter(
      (p) => p.categories?.includes("Utländska Program") && !p.categories?.includes("Dolda")
    );
    const langs = new Set<string>();
    foreign.forEach((p) => {
      if (p.country && p.country !== "SE") langs.add(p.country);
    });
    return Array.from(langs).sort();
  }, [programs]);

  const filteredPrograms = programs
    .filter((p) => !p.categories?.includes("Dolda"))
    .filter((p) => {
      if (selectedCategory === "all") return true;
      return p.categories?.includes(selectedCategory);
    })
    .filter((p) => {
      if (selectedCategory !== "Utländska Program" || selectedLanguage === "all") return true;
      return p.country === selectedLanguage;
    })
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.short_description?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    });

  const handleCategoryChange = (cat: string) => {
    if (cat === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ kategori: cat });
    }
  };

  const handleLanguageChange = (lang: string) => {
    if (lang === "all") {
      setSearchParams({ kategori: "Utländska Program" });
    } else {
      setSearchParams({ kategori: "Utländska Program", sprak: lang });
    }
  };

  return (
    <div className="min-h-screen pb-32 bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MobileHeader />

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl font-bold text-foreground mb-4"
        >
          Butik
        </motion.h1>

        {/* Search + Filter toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Sök program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-muted border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all outline-none text-sm text-foreground"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 rounded-xl transition-colors ${
              showFilters ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Category filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="flex flex-wrap gap-2 pb-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCategoryChange("all")}
                  className="rounded-full text-xs h-8"
                >
                  Alla
                </Button>
                {displayCategories.map((cat) => (
                  <Button
                    key={cat.name}
                    variant={selectedCategory === cat.name ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCategoryChange(cat.name)}
                    className="rounded-full text-xs h-8"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>

              {/* Language sub-filter */}
              {selectedCategory === "Utländska Program" && availableLanguages.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <Button
                    variant={selectedLanguage === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleLanguageChange("all")}
                    className="rounded-full text-xs h-8"
                  >
                    Alla språk
                  </Button>
                  {availableLanguages.map((lang) => (
                    <Button
                      key={lang}
                      variant={selectedLanguage === lang ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleLanguageChange(lang)}
                      className="rounded-full text-xs h-8"
                    >
                      {countryLabels[lang] || lang}
                    </Button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results count */}
        {!loadingPrograms && (
          <p className="text-xs text-muted-foreground mb-4">
            {filteredPrograms.length} program
          </p>
        )}

        {/* Loading */}
        {loadingPrograms && (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Programs list */}
        {!loadingPrograms && (
          <div className="grid grid-cols-1 gap-4">
            {filteredPrograms.map((program, index) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <ProgramCard
                  slug={program.slug}
                  title={program.title}
                  description={program.short_description || program.description || ""}
                  duration={program.duration_text || ""}
                  trackCount={trackCounts[program.id] || 0}
                  price={program.price}
                  image={program.image_url || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop"}
                  country={program.country}
                  categories={program.categories || []}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loadingPrograms && filteredPrograms.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Inga program hittades.</p>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileShop;
