import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Quote } from "lucide-react";
import { motion } from "motion/react";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import logoSvg from "@/assets/logo.svg";

const PLACEHOLDER_IMAGES: Record<string, string> = {
  "personlig-utveckling": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=400&fit=crop",
  "battre-halsa": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop",
  "barn-ungdom": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=400&fit=crop",
  "sport": "https://images.unsplash.com/photo-1461896836934-bd45ba48ba0e?w=600&h=400&fit=crop",
  "foretag-ledarskap": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
};

const MobileHome = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_hidden", false)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen pb-32 bg-background">
      <MobileHeader />

      <main className="max-w-2xl mx-auto px-6 pt-4">
        {/* Hero Logo */}
        <section className="flex flex-col items-center justify-center py-8">
          <motion.img
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            src={logoSvg}
            alt="Unestål Education"
            className="h-40 w-auto object-contain"
          />
        </section>

        {/* Search */}
        <section className="mb-12">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Sök efter program eller övningar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-muted border-none rounded-2xl focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all outline-none text-foreground"
            />
          </div>
        </section>

        {/* Categories Grid */}
        <section className="mb-12">
          <div className="flex justify-between items-end mb-6">
            <h3 className="font-display text-xl font-semibold">Utforska kategorier</h3>
            <button className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-70 transition-opacity font-body">
              Visa alla
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {categories?.map((cat, index) => (
              <motion.div
                key={cat.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative rounded-2xl overflow-hidden cursor-pointer group ${
                  index === 0 ? "col-span-2 h-48" : "h-40"
                }`}
              >
                <img
                  src={PLACEHOLDER_IMAGES[cat.slug] || `https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&h=400&fit=crop`}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div
                  className={`absolute inset-0 ${
                    index === 0
                      ? "bg-gradient-to-t from-primary/80 to-transparent"
                      : "bg-black/30"
                  }`}
                />
                <div className="absolute bottom-4 left-4 right-4">
                  {index === 0 && (
                    <span className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter mb-2 inline-block">
                      Mest populär
                    </span>
                  )}
                  <h4
                    className={`text-white font-display ${
                      index === 0 ? "text-xl" : "text-base"
                    } font-bold`}
                  >
                    {cat.name}
                  </h4>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Quote Section */}
        <section className="bg-muted p-8 rounded-2xl relative overflow-hidden mb-12">
          <Quote className="absolute top-4 right-4 w-12 h-12 text-primary/5" />
          <p className="font-display italic text-xl text-primary mb-4 leading-relaxed">
            "Mental träning handlar inte om att ändra på verkligheten, utan om att ändra din
            upplevelse av den."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-primary/30" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-body">
              Lars-Eric Uneståhl
            </span>
          </div>
        </section>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileHome;
