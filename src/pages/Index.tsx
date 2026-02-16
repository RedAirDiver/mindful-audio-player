import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ProgramsSection from "@/components/ProgramsSection";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import { useReferral } from "@/hooks/useReferral";

const Index = () => {
  useReferral();

  return (
    <div className="min-h-screen">
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
