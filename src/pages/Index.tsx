import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ProgramsSection from "@/components/ProgramsSection";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { useReferral } from "@/hooks/useReferral";

const Index = () => {
  useReferral();

  return (
    <div className="min-h-screen">
      <SEO
        title="Mentalträning – Professionella mentala träningsprogram"
        description="Hundratals ljudguidade mentala träningsprogram baserade på Uneståls metodik. Träna fokus, hantera stress och öka välbefinnandet."
        path="/"
      />
      <Header />
      <main>
        <Hero />
        <ProgramsSection />
        <Features />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
