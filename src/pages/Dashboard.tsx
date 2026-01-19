import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AudioPlayer from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { Headphones, User, LogOut, ChevronRight, Download, Wifi, WifiOff, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  track_order: number;
}

interface Program {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

interface Purchase {
  id: string;
  program_id: string;
  purchase_date: string;
  programs: Program;
}

interface PurchasedProgram extends Program {
  tracks: AudioFile[];
}

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [purchasedPrograms, setPurchasedPrograms] = useState<PurchasedProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<PurchasedProgram | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<AudioFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedOffline, setSavedOffline] = useState<Set<string>>(new Set());
  const [savingOffline, setSavingOffline] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchPurchasedPrograms();
    }
  }, [user, authLoading]);

  const fetchPurchasedPrograms = async () => {
    try {
      // Fetch purchases with program details
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select(`
          id,
          program_id,
          purchase_date,
          programs (
            id,
            title,
            description,
            image_url
          )
        `)
        .order('purchase_date', { ascending: false });

      if (purchasesError) throw purchasesError;

      if (!purchases || purchases.length === 0) {
        setPurchasedPrograms([]);
        setLoading(false);
        return;
      }

      // Fetch audio files for each purchased program
      const programIds = purchases.map(p => p.program_id);
      const { data: audioFiles, error: audioError } = await supabase
        .from('audio_files')
        .select('*')
        .in('program_id', programIds)
        .order('track_order', { ascending: true });

      if (audioError) throw audioError;

      // Combine data
      const programsWithTracks: PurchasedProgram[] = purchases.map(purchase => {
        const program = purchase.programs as unknown as Program;
        const tracks = (audioFiles || []).filter(af => af.program_id === program.id);
        return {
          ...program,
          tracks,
        };
      });

      setPurchasedPrograms(programsWithTracks);
      if (programsWithTracks.length > 0) {
        setSelectedProgram(programsWithTracks[0]);
        if (programsWithTracks[0].tracks.length > 0) {
          setSelectedTrack(programsWithTracks[0].tracks[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
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

  const handleSaveOffline = async (trackId: string) => {
    setSavingOffline(trackId);
    // TODO: Implement actual offline caching with Service Worker
    setTimeout(() => {
      setSavedOffline(prev => new Set(prev).add(trackId));
      setSavingOffline(null);
    }, 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Laddar dina program...</p>
        </div>
      </div>
    );
  }

  // No purchases view
  if (purchasedPrograms.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-md mx-auto text-center py-16">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-10 h-10 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-foreground mb-3">
                Inga program ännu
              </h1>
              <p className="text-muted-foreground mb-8">
                Du har inte köpt några program ännu. Utforska vårt utbud och börja din resa mot inre lugn.
              </p>
              <Button asChild size="lg">
                <Link to="/#programs">Utforska program</Link>
              </Button>
            </div>
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
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-semibold text-foreground">Mina program</h1>
              <p className="text-muted-foreground mt-1">Välkommen tillbaka! Här är dina köpta program.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/#programs">
                  Utforska fler program
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <User className="w-4 h-4 mr-2" />
                Profil
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logga ut
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Programs List */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="font-semibold text-foreground mb-4">Dina program</h2>
              {purchasedPrograms.map((program) => (
                <button
                  key={program.id}
                  onClick={() => {
                    setSelectedProgram(program);
                    if (program.tracks.length > 0) {
                      setSelectedTrack(program.tracks[0]);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                    selectedProgram?.id === program.id 
                      ? 'bg-primary/10 ring-2 ring-primary' 
                      : 'bg-card hover:bg-muted'
                  }`}
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {program.image_url ? (
                      <img src={program.image_url} alt={program.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Headphones className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{program.title}</h3>
                    <p className="text-sm text-muted-foreground">{program.tracks.length} spår</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Player & Tracks */}
            <div className="lg:col-span-2 space-y-6">
              {selectedProgram && selectedTrack && (
                <>
                  {/* Current Player */}
                  <AudioPlayer 
                    title={selectedTrack.title}
                    coverImage={selectedProgram.image_url || undefined}
                    duration={selectedTrack.duration_seconds || 180}
                  />

                  {/* Track List */}
                  <div className="bg-card rounded-2xl shadow-elegant p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-semibold text-foreground">
                        {selectedProgram.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Download className="w-4 h-4" />
                        <span>Spara för offline</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {selectedProgram.tracks.map((track, index) => (
                        <div
                          key={track.id}
                          className={`flex items-center gap-4 p-3 rounded-lg transition-all cursor-pointer ${
                            selectedTrack.id === track.id 
                              ? 'bg-primary/10' 
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => setSelectedTrack(track)}
                        >
                          {/* Track Number / Playing Indicator */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            selectedTrack.id === track.id 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {selectedTrack.id === track.id ? (
                              <Headphones className="w-4 h-4" />
                            ) : (
                              index + 1
                            )}
                          </div>

                          {/* Track Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${
                              selectedTrack.id === track.id ? 'text-primary' : 'text-foreground'
                            }`}>
                              {track.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDuration(track.duration_seconds)}
                            </p>
                          </div>

                          {/* Offline Status */}
                          <div className="flex items-center gap-2">
                            {savedOffline.has(track.id) ? (
                              <div className="flex items-center gap-1 text-sm text-primary">
                                <WifiOff className="w-4 h-4" />
                                <span className="hidden sm:inline">Sparad</span>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveOffline(track.id);
                                }}
                                disabled={savingOffline === track.id}
                                className="text-muted-foreground"
                              >
                                {savingOffline === track.id ? (
                                  <span className="flex items-center gap-1">
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Sparar...</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Spara</span>
                                  </span>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Offline Info */}
              <div className="bg-muted/50 rounded-xl p-4 flex items-start gap-3">
                <Wifi className="w-5 h-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Om offline-läge</p>
                  <p className="text-muted-foreground">
                    Sparade spår kan lyssnas utan internetuppkoppling. Klicka på "Spara" för att ladda ner spår till din enhet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
