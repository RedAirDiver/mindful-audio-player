import { Link } from "react-router-dom";
import { User, Heart, Baby, Trophy, Gift, Globe, ArrowRight } from "lucide-react";

const categories = [
  {
    title: "Personlig Utveckling",
    slug: "Personlig Utveckling",
    icon: User,
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=600&auto=format&fit=crop&q=80",
    color: "from-primary/80 to-primary/40",
  },
  {
    title: "Bättre hälsa",
    slug: "Bättre hälsa",
    icon: Heart,
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80",
    color: "from-accent/80 to-accent/40",
  },
  {
    title: "Barn & Ungdom",
    slug: "Barn & Ungdom",
    icon: Baby,
    image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&auto=format&fit=crop&q=80",
    color: "from-secondary-foreground/70 to-secondary-foreground/30",
  },
  {
    title: "Sport",
    slug: "Sport",
    icon: Trophy,
    image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&auto=format&fit=crop&q=80",
    color: "from-primary/80 to-primary/40",
  },
  {
    title: "Gratis",
    slug: "Gratisprogram",
    icon: Gift,
    image: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&auto=format&fit=crop&q=80",
    color: "from-accent/80 to-accent/40",
  },
  {
    title: "Utländska program",
    slug: "Utländska Program",
    icon: Globe,
    image: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80",
    color: "from-primary/80 to-primary/40",
  },
];

const ProgramsSection = () => {
  return (
    <section id="programs" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
            Mentala Träningsprogram
          </h2>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {categories.map((cat, index) => (
            <Link
              key={cat.slug}
              to={`/produkter?kategori=${encodeURIComponent(cat.slug)}`}
              className="group relative rounded-2xl overflow-hidden aspect-[4/3] shadow-elegant hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <img
                src={cat.image}
                alt={cat.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${cat.color} to-transparent opacity-80`} />
              <div className="absolute inset-0 bg-foreground/30" />
              <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-4 gap-2">
                <cat.icon className="w-8 h-8 text-primary-foreground drop-shadow-md" />
                <span className="font-display text-lg md:text-xl font-semibold text-primary-foreground drop-shadow-md">
                  {cat.title}
                </span>
              </div>
            </Link>
          ))}

          {/* Alla program – distinct style */}
          <Link
            to="/produkter"
            className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-primary shadow-elegant hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in-up flex items-center justify-center"
            style={{ animationDelay: `${categories.length * 0.05}s` }}
          >
            <div className="flex flex-col items-center gap-2 text-primary-foreground">
              <ArrowRight className="w-8 h-8" />
              <span className="font-display text-lg md:text-xl font-semibold">
                Alla program
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
