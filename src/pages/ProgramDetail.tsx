import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineAudio } from "@/hooks/useOfflineAudio";
import { 
  ArrowLeft, 
  Headphones, 
  Clock, 
  Star, 
  Play, 
  Pause, 
  Lock,
  Check,
  ShoppingCart,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Download,
  CloudOff,
  Wifi,
  WifiOff,
  Loader2,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

/** Strip HTML tags and decode common entities for plain-text display */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface Program {
  id: string;
  slug: string;
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
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { 
    savedTracks, 
    savingTrack, 
    saveTrackOffline, 
    removeTrackOffline, 
    getDecryptedAudioUrl, 
    isOnline 
  } = useOfflineAudio();
  const [program, setProgram] = useState<Program | null>(null);
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchased, setIsPurchased] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [playingOffline, setPlayingOffline] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (slug) {
      fetchProgram();
    }
  }, [slug, user]);

  const fetchProgram = async () => {
    try {
      // Fetch program by slug
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (programError) throw programError;
      if (!programData) {
        setLoading(false);
        return;
      }

      setProgram(programData);

      // Fetch tracks (including file_path for preview functionality)
      const { data: tracksData, error: tracksError } = await supabase
        .from('audio_files')
        .select('id, title, duration_seconds, track_order, file_path')
        .eq('program_id', programData.id)
        .order('track_order', { ascending: true });

      if (!tracksError && tracksData) {
        setTracks(tracksData);
      }

      // Check if user has purchased this program
      if (user) {
        const { data: purchaseData } = await supabase
          .from('purchases')
          .select('id')
          .eq('program_id', programData.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (purchaseData) {
          setIsPurchased(true);
          // If purchased, fetch actual track data
          const { data: actualTracks } = await supabase
            .from('audio_files')
            .select('*')
            .eq('program_id', programData.id)
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

  // Handle audio time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      // Auto-play next track if available
      if (currentTrackIndex !== null && currentTrackIndex < tracks.length - 1) {
        playTrack(currentTrackIndex + 1);
      } else {
        setIsPlaying(false);
        setCurrentTrackIndex(null);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex, tracks.length]);

  // Play a purchased track (with offline support)
  const playTrack = async (index: number) => {
    const track = tracks[index];
    if (!track || !isPurchased || !track.file_path) return;

    try {
      let audioUrl: string | null = null;

      // Check if track is saved offline first
      if (savedTracks.has(track.id)) {
        audioUrl = await getDecryptedAudioUrl(track.id);
        if (audioUrl) {
          setPlayingOffline(true);
        }
      }

      // If not offline or decryption failed, try online
      if (!audioUrl) {
        if (!isOnline) {
          toast.error("Du är offline", {
            description: "Spara spåret för offline-lyssning först"
          });
          return;
        }

        const { data, error } = await supabase.storage
          .from("audio-files")
          .createSignedUrl(track.file_path, 3600);

        if (error) throw error;
        audioUrl = data?.signedUrl || null;
        setPlayingOffline(false);
      }

      if (audioUrl && audioRef.current) {
        // Revoke previous blob URL if exists
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current.src = audioUrl;
        audioRef.current.volume = volume / 100;
        await audioRef.current.play();
        setCurrentTrackIndex(index);
        setIsPlaying(true);
        setPreviewTrack(null);
      }
    } catch (error: any) {
      console.error('Error playing track:', error);
      toast.error("Kunde inte spela upp spåret");
    }
  };

  // Save track for offline listening
  const handleSaveOffline = async (e: React.MouseEvent, track: AudioFile) => {
    e.stopPropagation();
    if (!track.file_path) return;
    
    await saveTrackOffline(track.id, track.file_path, {
      title: track.title,
      duration: track.duration_seconds || 0
    });
  };

  // Remove track from offline storage
  const handleRemoveOffline = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    await removeTrackOffline(trackId);
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (currentTrackIndex !== null) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (tracks.length > 0 && isPurchased) {
      playTrack(0);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(80);
      if (audioRef.current) audioRef.current.volume = 0.8;
    } else {
      setVolume(0);
      if (audioRef.current) audioRef.current.volume = 0;
    }
    setIsMuted(!isMuted);
  };

  const skipTrack = (direction: 'prev' | 'next') => {
    if (currentTrackIndex === null) return;
    const newIndex = direction === 'next' ? currentTrackIndex + 1 : currentTrackIndex - 1;
    if (newIndex >= 0 && newIndex < tracks.length) {
      playTrack(newIndex);
    }
  };

  // Preview playback - actual audio for first 30 seconds
  const togglePreview = async (trackId: string) => {
    // Stop any real playback first
    if (audioRef.current) {
      audioRef.current.pause();
      setCurrentTrackIndex(null);
    }
    
    // If same track is playing, stop it
    if (previewTrack === trackId && isPlaying) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsPlaying(false);
      setPreviewTrack(null);
      setPreviewProgress(0);
      return;
    }

    // Find the track to get file_path
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.file_path) {
      toast.error("Kunde inte ladda förhandslyssning");
      return;
    }

    setPreviewLoading(true);
    
    try {
      // Get signed URL for the track
      const { data, error } = await supabase.storage
        .from("audio-files")
        .createSignedUrl(track.file_path, 300); // 5 min expiry for preview

      if (error || !data?.signedUrl) {
        throw new Error("Kunde inte hämta ljudfil");
      }

      if (previewAudioRef.current) {
        previewAudioRef.current.src = data.signedUrl;
        previewAudioRef.current.volume = volume / 100;
        await previewAudioRef.current.play();
        
        setPreviewTrack(trackId);
        setIsPlaying(true);
        setPreviewProgress(0);
        
        toast.info("Förhandslyssning: 30 sekunder", {
          description: "Köp produkten för att lyssna på hela spåret"
        });
      }
    } catch (error: any) {
      console.error('Error starting preview:', error);
      toast.error("Kunde inte spela förhandslyssning");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle preview audio time update and 30-second limit
  useEffect(() => {
    const previewAudio = previewAudioRef.current;
    if (!previewAudio) return;

    const handleTimeUpdate = () => {
      const currentSeconds = Math.floor(previewAudio.currentTime);
      setPreviewProgress(currentSeconds);
      
      // Stop at 30 seconds
      if (previewAudio.currentTime >= 30) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        setIsPlaying(false);
        setPreviewTrack(null);
        setPreviewProgress(0);
        toast.info("Förhandslyssningen är slut", {
          description: "Köp produkten för att lyssna på hela spåret"
        });
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPreviewTrack(null);
      setPreviewProgress(0);
    };

    previewAudio.addEventListener('timeupdate', handleTimeUpdate);
    previewAudio.addEventListener('ended', handleEnded);

    return () => {
      previewAudio.removeEventListener('timeupdate', handleTimeUpdate);
      previewAudio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const handlePurchase = async () => {
    if (!user) {
      toast.error("Logga in för att köpa", {
        description: "Du måste vara inloggad för att köpa produkter"
      });
      return;
    }

    // For now, simulate purchase (Stripe integration later)
    try {
      const { error } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          program_id: program?.id,
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
          <p className="text-muted-foreground">Laddar produkt...</p>
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
              Produkten hittades inte
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
            <span>Tillbaka till produkter</span>
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
                <div 
                  className="mt-4 text-lg text-muted-foreground leading-relaxed prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: program.description || program.short_description || "" }}
                />
              </div>

              {/* Price & Purchase */}
              <div className="bg-card rounded-2xl p-6 shadow-elegant space-y-4">
                {isPurchased ? (
                  <div className="flex items-center gap-3 text-primary">
                    <Check className="w-6 h-6" />
                    <span className="font-semibold text-lg">Du äger denna produkt</span>
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

              {/* Audio Player for purchased programs */}
              {isPurchased && tracks.length > 0 && (
                <div className="bg-card rounded-2xl p-6 shadow-elegant space-y-4">
                  <audio ref={audioRef} className="hidden" />
                  <audio ref={previewAudioRef} className="hidden" />
                  
                  {/* Online/Offline Status */}
                  <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full w-fit ${
                    isOnline 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-accent/10 text-accent'
                  }`}>
                    {isOnline ? (
                      <>
                        <Wifi className="w-3 h-3" />
                        <span>Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        <span>Offline-läge</span>
                      </>
                    )}
                    {playingOffline && currentTrackIndex !== null && (
                      <span className="ml-1">• Spelar från cache</span>
                    )}
                  </div>
                  
                  {/* Current Track Info */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Headphones className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {currentTrackIndex !== null ? tracks[currentTrackIndex]?.title : 'Välj ett spår'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currentTrackIndex !== null ? `Spår ${currentTrackIndex + 1} av ${tracks.length}` : program.title}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={1}
                      onValueChange={handleSeek}
                      className="cursor-pointer"
                      disabled={currentTrackIndex === null}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 w-28">
                      <button 
                        onClick={toggleMute} 
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </button>
                      <Slider
                        value={[volume]}
                        max={100}
                        step={1}
                        onValueChange={handleVolumeChange}
                        className="cursor-pointer flex-1"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => skipTrack('prev')}
                        disabled={currentTrackIndex === null || currentTrackIndex === 0}
                      >
                        <SkipBack className="w-5 h-5" />
                      </Button>
                      <Button 
                        size="lg"
                        className="w-12 h-12 rounded-full"
                        onClick={togglePlayPause}
                      >
                        {isPlaying && currentTrackIndex !== null ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => skipTrack('next')}
                        disabled={currentTrackIndex === null || currentTrackIndex === tracks.length - 1}
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="w-28" />
                  </div>
                </div>
              )}

              {/* Hidden audio element for preview playback (non-purchased users) */}
              {!isPurchased && <audio ref={previewAudioRef} className="hidden" />}

              {/* Track List */}
              <div className="space-y-4">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Innehåll
                </h2>
                <div className="bg-card rounded-2xl shadow-elegant overflow-hidden">
                  {tracks.map((track, index) => {
                    const isTrackSaved = savedTracks.has(track.id);
                    const isSaving = savingTrack === track.id;
                    
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          index !== tracks.length - 1 ? 'border-b border-border' : ''
                        } ${currentTrackIndex === index ? 'bg-primary/5' : ''}`}
                        onClick={() => isPurchased ? playTrack(index) : togglePreview(track.id)}
                      >
                        {/* Play/Preview Button */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                            (isPurchased && currentTrackIndex === index && isPlaying) || 
                            (!isPurchased && previewTrack === track.id && isPlaying)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {previewLoading && !isPurchased && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          {!previewLoading && (
                            (isPurchased && currentTrackIndex === index && isPlaying) || 
                            (!isPurchased && previewTrack === track.id && isPlaying) ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )
                          )}
                        </div>

                        {/* Track Info */}
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">
                              {track.title}
                            </p>
                            {/* Offline indicator */}
                            {isPurchased && isTrackSaved && (
                              <span title="Sparad offline">
                                <CloudOff className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatDuration(track.duration_seconds)}</span>
                            {!isPurchased && (
                              <span className="flex items-center gap-1 text-xs">
                                <Lock className="w-3 h-3" />
                                30s förhandslyssning
                              </span>
                            )}
                          </div>
                          {/* Preview Progress for non-purchased */}
                          {!isPurchased && previewTrack === track.id && (
                            <div className="mt-2 space-y-1">
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all duration-300"
                                  style={{ width: `${(previewProgress / 30) * 100}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{previewProgress}s</span>
                                <span>30s förhandslyssning</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Offline Save/Remove Button for purchased tracks */}
                        {isPurchased && track.file_path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={(e) => isTrackSaved ? handleRemoveOffline(e, track.id) : handleSaveOffline(e, track)}
                            disabled={isSaving}
                            title={isTrackSaved ? "Ta bort offline-sparning" : "Spara för offline-lyssning"}
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isTrackSaved ? (
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Download className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        )}

                        {/* Lock Icon for non-purchased */}
                        {!isPurchased && (
                          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
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
