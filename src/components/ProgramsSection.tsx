import { useEffect, useState } from "react";
import ProgramCard from "./ProgramCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Program {
  id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  duration_text: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  categories: string[] | null;
}

const CATEGORIES = [
  { id: 'all', label: 'Alla' },
  { id: 'Personlig Utveckling', label: 'Personlig Utveckling' },
  { id: 'Bättre hälsa', label: 'Bättre hälsa' },
  { id: 'Barn & Ungdom', label: 'Barn & Ungdom' },
  { id: 'Sport excellens', label: 'Sport' },
  { id: 'Gratisprogram', label: 'Gratis' },
];

const ProgramsSection = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const { data: programsData, error: programsError } = await supabase
        .from('programs')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: false });

      if (programsError) throw programsError;

      if (programsData) {
        setPrograms(programsData);
        
        // Fetch track counts for each program
        const counts: Record<string, number> = {};
        for (const program of programsData) {
          const { count, error } = await supabase
            .from('audio_files')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', program.id);
          
          if (!error && count !== null) {
            counts[program.id] = count;
          }
        }
        setTrackCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = programs.filter(program => {
    if (selectedCategory === 'all') return true;
    return program.categories?.includes(selectedCategory);
  });

  if (loading) {
    return (
      <section className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              Våra program
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Laddar program...
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="programs" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
            Våra program
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Välj bland våra professionellt framtagna program för mental träning och avslappning.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="rounded-full"
            >
              {category.label}
            </Button>
          ))}
        </div>

        {/* Programs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPrograms.map((program, index) => (
            <div 
              key={program.id} 
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <ProgramCard 
                id={program.id}
                title={program.title}
                description={program.short_description || program.description || ''}
                duration={program.duration_text || ''}
                trackCount={trackCounts[program.id] || 0}
                price={program.price}
                image={program.image_url || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop'}
                rating={5}
                featured={index === 0 && selectedCategory === 'all'}
                categories={program.categories || []}
              />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredPrograms.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Inga program hittades i denna kategori.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProgramsSection;
