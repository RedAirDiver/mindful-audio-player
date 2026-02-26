import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Play, Sparkles } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 py-20 text-center text-white">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium animate-fade-in">
            <Sparkles className="w-4 h-4" />
            <span>Upptäck kraften i ditt sinne</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight text-balance animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Stärk ditt mentala välbefinnande med{' '}
            <span className="text-white/90">guidade program</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Professionella mentala träningsprogram för avslappning och fokus. Lyssna var du vill – online eller offline.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/programs">
                Utforska mentala träningsprogram
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/programs" className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Prova gratis
              </Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="pt-12 flex flex-wrap items-center justify-center gap-8 text-white/60 text-sm animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
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
