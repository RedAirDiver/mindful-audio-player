import ProgramCard from "./ProgramCard";

// Mock data - will be replaced with real data from backend
const programs = [
  {
    id: "1",
    title: "Djup Avslappning",
    description: "Guidade meditationer för att släppa stress och hitta inre lugn. Perfekt för kvällen.",
    duration: "45 min",
    trackCount: 8,
    price: 299,
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop",
    rating: 5,
    featured: true,
  },
  {
    id: "2",
    title: "Fokus & Koncentration",
    description: "Öka din mentala skärpa och förbättra din koncentrationsförmåga med dessa övningar.",
    duration: "30 min",
    trackCount: 6,
    price: 249,
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&auto=format&fit=crop",
    rating: 5,
  },
  {
    id: "3",
    title: "Bättre Sömn",
    description: "Sömnmeditationer som hjälper dig somna snabbare och sova djupare.",
    duration: "60 min",
    trackCount: 10,
    price: 349,
    image: "https://images.unsplash.com/photo-1511295742362-92c96b1cf484?w=800&auto=format&fit=crop",
    rating: 4,
  },
  {
    id: "4",
    title: "Självförtroende",
    description: "Stärk din inre styrka och bygg ett orubbligt självförtroende.",
    duration: "35 min",
    trackCount: 7,
    price: 279,
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop",
    rating: 5,
  },
];

const ProgramsSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
            Våra program
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Välj bland våra professionellt framtagna program för mental träning och avslappning.
          </p>
        </div>

        {/* Programs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {programs.map((program, index) => (
            <div 
              key={program.id} 
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <ProgramCard {...program} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
