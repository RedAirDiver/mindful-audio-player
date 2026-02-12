import { Headphones, Cloud, Download, Shield } from "lucide-react";

const features = [
  {
    icon: Headphones,
    title: "Professionellt producerat",
    description: "Högkvalitativa ljudinspelningar skapade av certifierade mental tränare.",
  },
  {
    icon: Cloud,
    title: "Streama var som helst",
    description: "Lyssna direkt i din webbläsare utan att behöva installera något.",
  },
  {
    icon: Download,
    title: "Offline-läge",
    description: "Spara dina favoritprodukter för att lyssna även utan internetuppkoppling.",
  },
  {
    icon: Shield,
    title: "Livstidsåtkomst",
    description: "Köp en gång och få tillgång till dina produkter för alltid.",
  },
];

const Features = () => {
  return (
    <section className="py-20 md:py-28 gradient-subtle">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
            Varför välja oss?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Vi erbjuder en unik upplevelse för din mentala träning
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="text-center p-6 rounded-2xl bg-card shadow-sm hover:shadow-elegant transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-5">
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
