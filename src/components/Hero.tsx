import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Sparkles, Brain, Target, Heart, Zap, Shield, Clock, Star } from "lucide-react";

const benefits = [
  { icon: Heart, text: "Stärka din självbild och självkänsla" },
  { icon: Target, text: "Skapa tydliga magiska målbilder, värden och riktning i livet" },
  { icon: Brain, text: "Hantera stress och hitta inre lugn" },
  { icon: Zap, text: "Förbättra fokus, motivation och prestation" },
  { icon: Shield, text: "Bygga ett starkt självledarskap" },
  { icon: Clock, text: "Städa upp ditt förflutna, forma din framtid och lev i nuet" },
  { icon: Star, text: "Förebygg ohälsa" },
];

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 py-32 md:py-40 text-center text-foreground">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full text-sm font-medium animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Upptäck kraften i ditt sinne</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight text-balance animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Välkommen till vår plattform och app där 100-tals Mentala Träningsprogram finns för dig.
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Här får du tillgång till beprövad mental träning baserad på Uneståls metodik – kombinerad med modern forskning inom hjärnan, och dina tankar, beteende, känslor och inlärning.
          </p>

          {/* Sub-headline */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-4">
              Utveckla din fulla potential
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed italic">
              Mental träning handlar inte om att bli någon annan –<br className="hidden md:block" />
              det handlar om att bli mer av den du är, när du är som bäst i alla situationer.
            </p>
          </div>

          {/* Benefits section */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <p className="text-lg text-muted-foreground font-medium mb-6">
              Genom våra program lär du dig att:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto text-left">
              {benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-primary/8 backdrop-blur-sm rounded-xl px-4 py-3 transition-all hover:bg-primary/15"
                >
                  <benefit.icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                  <span className="text-sm md:text-base text-foreground/85">{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Closing statement */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
            Med mental träning kan du utveckla vilket område du än väljer.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center pt-2 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/products">
                Utforska mentala träningsprogram
              </Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-8 text-white/60 text-sm animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white/40 rounded-full" />
              <span>Över 1000+ nöjda användare</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white/40 rounded-full" />
              <span>Lyssna offline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white/40 rounded-full" />
              <span>Livstids tillgång</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute -bottom-px left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path 
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" 
            fill="hsl(var(--background))"
          />
        </svg>
      </div>
    </section>
  );
};

export default Hero;
