import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowLeft, 
  Headphones, 
  Clock, 
  Star, 
  Play, 
  Pause, 
  Lock,
  Check,
  ShoppingCart
} from "lucide-react";
import { toast } from "sonner";

interface Program {
  id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  price: number;
  image_url: string | null;
  duration_text: string | null;
}

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  track_order: number;
}

const ProgramDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchased, setIsPurchased] = useState(false);
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (id) {
      fetchProgram();
    }
  }, [id, user]);

  const fetchProgram = async () => {
    try {
      // Fetch program
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();

      if (programError) throw programError;
      if (!programData) {
        setLoading(false);
        return;
      }

      setProgram(programData);

      // Fetch track count (not full track data - that's protected by RLS)
      const { count } = await supabase
        .from('audio_files')
        .select('*', { count: 'exact', head: true })
        .eq('program_id', id);

      // Create placeholder tracks for display
      if (count && count > 0) {
        const placeholderTracks: AudioFile[] = Array.from({ length: count }, (_, i) => ({
          id: `placeholder-${i}`,
          title: `Spår ${i + 1}`,
          file_path: '',
          duration_seconds: null,
          track_order: i + 1,
        }));
        setTracks(placeholderTracks);
      }

      // Check if user has purchased this program
      if (user) {
        const { data: purchaseData } = await supabase
          .from('purchases')
          .select('id')
          .eq('program_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (purchaseData) {
          setIsPurchased(true);
          // If purchased, fetch actual track data
          const { data: actualTracks } = await supabase
            .from('audio_files')
            .select('*')
            .eq('program_id', id)
            .order('track_order', { ascending: true });
          
          if (actualTracks) {
            setTracks(actualTracks);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching program:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Preview playback (simulated - first 30 seconds)
  const togglePreview = (trackId: string) => {
    if (previewTrack === trackId && isPlaying) {
      setIsPlaying(false);
      setPreviewTrack(null);
      setPreviewProgress(0);
    } else {
      setPreviewTrack(trackId);
      setIsPlaying(true);
      setPreviewProgress(0);
      
      // Simulate 30 second preview
      toast.info("Förhandslyssning: 30 sekunder", {
        description: "Köp programmet för att lyssna på hela spåret"
      });
    }
  };

  // Simulate preview progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && previewTrack) {
      interval = setInterval(() => {
        setPreviewProgress(prev => {
          if (prev >= 30) {
            setIsPlaying(false);
            setPreviewTrack(null);
            toast.info("Förhandslyssningen är slut", {
              description: "Köp programmet för att lyssna på hela spåret"
            });
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, previewTrack]);

  const handlePurchase = async () => {
    if (!user) {
      toast.error("Logga in för att köpa", {
        description: "Du måste vara inloggad för att köpa program"
      });
      return;
    }

    // For now, simulate purchase (Stripe integration later)
    try {
      const { error } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          program_id: id,
          amount_paid: program?.price || 0,
        });

      if (error) throw error;

      setIsPurchased(true);
      toast.success("Köp genomfört!", {
        description: "Du kan nu lyssna på alla spår"
      });
      
      // Refresh to get actual tracks
      fetchProgram();
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error("Kunde inte genomföra köp", {
        description: error.message
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Laddar program...</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 text-center py-16">
            <h1 className="font-display text-2xl font-semibold text-foreground mb-4">
              Programmet hittades inte
            </h1>
            <Button asChild>
              <Link to="/">Tillbaka till startsidan</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back Link */}
          <Link 
            to="/#programs" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tillbaka till program</span>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Program Image & Info */}
            <div className="space-y-6">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
                <img 
                  src={program.image_url || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop'} 
                  alt={program.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Meta */}
              <div className="flex items-center gap-6 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Headphones className="w-5 h-5" />
                  <span>{tracks.length} spår</span>
                </div>
                {program.duration_text && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span>{program.duration_text}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-accent fill-accent" />
                  ))}
                </div>
              </div>
            </div>

            {/* Program Details */}
            <div className="space-y-8">
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
                  {program.title}
                </h1>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  {program.description || program.short_description}
                </p>
              </div>

              {/* Price & Purchase */}
              <div className="bg-card rounded-2xl p-6 shadow-elegant space-y-4">
                {isPurchased ? (
                  <div className="flex items-center gap-3 text-primary">
                    <Check className="w-6 h-6" />
                    <span className="font-semibold text-lg">Du äger detta program</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-3xl font-semibold text-foreground">{program.price}</span>
                        <span className="text-lg text-muted-foreground ml-1">kr</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Engångsköp • Livstidsåtkomst
                      </div>
                    </div>
                    <Button 
                      size="lg" 
                      className="w-full"
                      onClick={handlePurchase}
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      {user ? 'Köp nu' : 'Logga in för att köpa'}
                    </Button>
                  </>
                )}
              </div>

              {/* Track List */}
              <div className="space-y-4">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Innehåll
                </h2>
                <div className="bg-card rounded-2xl shadow-elegant overflow-hidden">
                  {tracks.map((track, index) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-4 p-4 ${
                        index !== tracks.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      {/* Play/Preview Button */}
                      <button
                        onClick={() => togglePreview(track.id)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          previewTrack === track.id && isPlaying
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary'
                        }`}
                      >
                        {previewTrack === track.id && isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {isPurchased ? track.title : `Spår ${index + 1}`}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDuration(track.duration_seconds)}</span>
                          {!isPurchased && (
                            <span className="flex items-center gap-1 text-xs">
                              <Lock className="w-3 h-3" />
                              30s förhandslyssning
                            </span>
                          )}
                        </div>
                        {/* Preview Progress */}
                        {previewTrack === track.id && isPlaying && (
                          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-1000"
                              style={{ width: `${(previewProgress / 30) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Lock Icon for non-purchased */}
                      {!isPurchased && (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground">Inkluderat:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    Livstidsåtkomst till alla spår
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    Offline-lyssning på mobil
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    Streama på alla enheter
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    Professionellt producerat ljud
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProgramDetail;
