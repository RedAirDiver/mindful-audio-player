import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineAudio } from "@/hooks/useOfflineAudio";
import { StripeCheckout } from "@/components/StripeCheckout";
import { getReferralCode, clearReferralCode } from "@/hooks/useReferral";
import AudioPlayer from "@/components/AudioPlayer";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Headphones,
  Clock,
  Play,
  Pause,
  Lock,
  Check,
  ShoppingCart,
  Mail,
  Download,
  CloudOff,
  Loader2,
  Trash2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface Program {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  short_description: string | null;
  price: number;
  image_url: string | null;
  duration_text: string | null;
  pdf_file_path: string | null;
}

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  track_order: number;
}

const MobileProgramDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    savedTracks,
    savingTrack,
    saveTrackOffline,
    removeTrackOffline,
    getDecryptedAudioUrl,
    isOnline,
  } = useOfflineAudio();

  const [program, setProgram] = useState<Program | null>(null);
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchased, setIsPurchased] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Swipe right to go back: >100px horizontal, not too much vertical
    if (deltaX > 100 && deltaY < 80) {
      navigate(-1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  useEffect(() => {
    if (slug) fetchProgram();
  }, [slug, user]);

  const fetchProgram = async () => {
    try {
      const { data: programData, error: programError } = await supabase
        .from("programs")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (programError) throw programError;
      if (!programData) {
        setLoading(false);
        return;
      }

      setProgram(programData);

      const { data: linkData, error: tracksError } = (await supabase
        .from("program_audio_files")
        .select("track_order, audio_files(id, title, duration_seconds, file_path)")
        .eq("program_id", programData.id)
        .order("track_order", { ascending: true })) as any;

      if (!tracksError && linkData) {
        setTracks(
          linkData.map((l: any) => ({ ...l.audio_files, track_order: l.track_order }))
        );
      }

      if (user) {
        const { data: purchaseData } = await supabase
          .from("purchases")
          .select("id")
          .eq("program_id", programData.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (purchaseData) {
          setIsPurchased(true);
          const { data: actualLinks } = (await supabase
            .from("program_audio_files")
            .select("track_order, audio_files(*)")
            .eq("program_id", programData.id)
            .order("track_order", { ascending: true })) as any;

          if (actualLinks) {
            setTracks(
              actualLinks.map((l: any) => ({ ...l.audio_files, track_order: l.track_order }))
            );
          }
        }
      }
    } catch (error) {
      console.error("Error fetching program:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Load audio URL
  useEffect(() => {
    const loadAudioUrl = async () => {
      if (currentTrackIndex === null) {
        setCurrentAudioUrl(null);
        return;
      }
      const track = tracks[currentTrackIndex];
      if (!track?.file_path) return;

      if (savedTracks.has(track.id)) {
        const offlineUrl = await getDecryptedAudioUrl(track.id);
        if (offlineUrl) {
          setCurrentAudioUrl(offlineUrl);
          return;
        }
      }

      if (isOnline) {
        try {
          const { data, error } = await supabase.storage
            .from("audio-files")
            .createSignedUrl(track.file_path, 3600);
          if (!error && data?.signedUrl) {
            setCurrentAudioUrl(data.signedUrl);
            return;
          }
        } catch (err) {
          console.error("Error getting audio URL:", err);
        }
      }
      setCurrentAudioUrl(null);
    };

    loadAudioUrl();
    return () => {
      if (currentAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(currentAudioUrl);
    };
  }, [currentTrackIndex, tracks, savedTracks, isOnline, getDecryptedAudioUrl]);

  const playTrack = (index: number) => {
    const track = tracks[index];
    if (!track || !isPurchased || !track.file_path) return;
    if (!isOnline && !savedTracks.has(track.id)) {
      toast.error("Du är offline", { description: "Spara spåret för offline-lyssning först" });
      return;
    }
    setCurrentTrackIndex(index);
    setPreviewTrack(null);
  };

  const skipTrack = (direction: "prev" | "next") => {
    if (currentTrackIndex === null) return;
    const newIndex = direction === "next" ? currentTrackIndex + 1 : currentTrackIndex - 1;
    if (newIndex >= 0 && newIndex < tracks.length) playTrack(newIndex);
  };

  const handleSaveOffline = async (e: React.MouseEvent, track: AudioFile) => {
    e.stopPropagation();
    if (!track.file_path) return;
    await saveTrackOffline(track.id, track.file_path, {
      title: track.title,
      duration: track.duration_seconds || 0,
    });
  };

  const handleRemoveOffline = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    await removeTrackOffline(trackId);
  };

  const togglePreview = async (trackId: string) => {
    setCurrentTrackIndex(null);
    setCurrentAudioUrl(null);

    if (previewTrack === trackId && isPlaying) {
      previewAudioRef.current?.pause();
      setIsPlaying(false);
      setPreviewTrack(null);
      setPreviewProgress(0);
      return;
    }

    const track = tracks.find((t) => t.id === trackId);
    if (!track?.file_path) {
      toast.error("Kunde inte ladda förhandslyssning");
      return;
    }

    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("audio-files")
        .createSignedUrl(track.file_path, 300);
      if (error || !data?.signedUrl) throw new Error("Kunde inte hämta ljudfil");

      if (previewAudioRef.current) {
        previewAudioRef.current.src = data.signedUrl;
        previewAudioRef.current.volume = 0.8;
        previewAudioRef.current.currentTime = 60;
        await previewAudioRef.current.play();
        setPreviewTrack(trackId);
        setIsPlaying(true);
        setPreviewProgress(0);
      }
    } catch {
      toast.error("Kunde inte spela förhandslyssning");
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    const onTime = () => {
      const elapsed = Math.floor(audio.currentTime - 60);
      setPreviewProgress(Math.max(0, elapsed));
      if (audio.currentTime >= 150) {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
        setPreviewTrack(null);
        setPreviewProgress(0);
        toast.info("Förhandslyssningen är slut");
      }
    };
    const onEnd = () => {
      setIsPlaying(false);
      setPreviewTrack(null);
      setPreviewProgress(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const handlePurchase = async () => {
    if (!user && !guestEmail.trim()) {
      toast.error("Ange din e-postadress för att köpa");
      return;
    }
    setPurchaseLoading(true);
    const refCode = getReferralCode();
    try {
      if (user) {
        const { data, error } = await supabase.functions.invoke("guest-purchase", {
          body: { email: user.email, program_id: program?.id, referral_code: refCode || undefined },
        });
        if (error) throw error;
        if (data?.error && !data.already_purchased) throw new Error(data.error);
        if (data?.already_purchased) {
          toast.info("Du har redan köpt denna produkt");
          setPurchaseLoading(false);
          return;
        }
      } else {
        const { data, error } = await supabase.functions.invoke("guest-purchase", {
          body: { email: guestEmail.trim(), name: guestName.trim(), program_id: program?.id, referral_code: refCode || undefined },
        });
        if (error) throw error;
        if (data?.error) {
          if (data.already_purchased) {
            toast.info("Du har redan köpt denna produkt");
            setPurchaseLoading(false);
            return;
          }
          throw new Error(data.error);
        }
        if (data?.user_created) {
          toast.success("Konto skapat!", { description: "Kolla din e-post för att sätta ett lösenord.", duration: 8000 });
        }
      }
      if (refCode) clearReferralCode();
      setIsPurchased(true);
      toast.success("Köp genomfört!", { description: user ? "Du kan nu lyssna på alla spår" : "Logga in för att börja lyssna" });
      if (user) fetchProgram();
    } catch (error: any) {
      toast.error("Kunde inte genomföra köp", { description: error.message });
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!program) {
  return (
    <div className="min-h-screen pb-32 bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MobileHeader />
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <span className="font-display text-lg font-semibold text-foreground">Hittades inte</span>
          </div>
        </div>
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Produkten hittades inte.</p>
          <Button className="mt-4" onClick={() => navigate("/produkter")}>
            Till butiken
          </Button>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-background">
      {/* Hero image with back button overlay */}
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          <img
            src={program.image_url || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop"}
            alt={program.title}
            className="w-full h-full object-cover"
          />
        </div>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <main className="px-6 -mt-6 relative z-10">
        {/* Title card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl shadow-sm p-6 space-y-3"
        >
          <h1 className="font-display text-2xl font-bold text-foreground">{program.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Headphones className="w-4 h-4" />
              <span>{tracks.length} spår</span>
            </div>
            {program.duration_text && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{program.duration_text}</span>
              </div>
            )}
          </div>

          {/* Price / purchased status */}
          {isPurchased ? (
            <div className="flex items-center gap-2 text-primary pt-1">
              <Check className="w-5 h-5" />
              <span className="font-semibold">Du äger denna produkt</span>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-2xl font-bold text-foreground">
                  {program.price === 0 ? "Gratis" : `${program.price} kr`}
                </span>
                {program.price > 0 && (
                  <p className="text-xs text-muted-foreground">Inkl. 6% moms</p>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Purchase section */}
        {!isPurchased && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 bg-card rounded-2xl shadow-sm p-4 overflow-hidden"
          >
            {user ? (
              <StripeCheckout
                programId={program.id}
                programTitle={program.title}
                price={program.price}
                onPurchaseComplete={() => {
                  setIsPurchased(true);
                  fetchProgram();
                }}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Logga in eller skapa ett konto för att köpa detta program.
                </p>
                <Button
                  className="w-full h-12 rounded-xl text-base font-semibold"
                  onClick={() => navigate("/login")}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Logga in för att köpa
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Audio Player */}
        {isPurchased && tracks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4"
          >
            <AudioPlayer
              title={currentTrackIndex !== null ? tracks[currentTrackIndex]?.title : "Välj ett spår"}
              subtitle={currentTrackIndex !== null ? `Spår ${currentTrackIndex + 1} av ${tracks.length}` : program.title}
              coverImage={program.image_url || undefined}
              duration={currentTrackIndex !== null ? (tracks[currentTrackIndex]?.duration_seconds || 180) : 180}
              audioUrl={currentAudioUrl || undefined}
              onSkipPrev={() => skipTrack("prev")}
              onSkipNext={() => skipTrack("next")}
              canSkipPrev={currentTrackIndex !== null && currentTrackIndex > 0}
              canSkipNext={currentTrackIndex !== null && currentTrackIndex < tracks.length - 1}
              onEnded={() => {
                if (currentTrackIndex !== null && currentTrackIndex < tracks.length - 1) playTrack(currentTrackIndex + 1);
              }}
            />
          </motion.div>
        )}

        {!isPurchased && <audio ref={previewAudioRef} className="hidden" />}

        {/* PDF Download */}
        {isPurchased && program.pdf_file_path && (
          <div className="mt-4 bg-card rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm">Medföljande PDF</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <a href={program.pdf_file_path} target="_blank" rel="noopener noreferrer" download>
                Ladda ner
              </a>
            </Button>
          </div>
        )}

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4 bg-card rounded-2xl shadow-sm p-6"
        >
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">Om programmet</h2>
          <div
            className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: program.description || program.short_description || "" }}
          />
        </motion.div>

        {/* Track list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 bg-card rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="p-6 pb-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Innehåll ({tracks.length} spår)
            </h2>
          </div>
          {tracks.map((track, index) => {
            const isTrackSaved = savedTracks.has(track.id);
            const isSaving = savingTrack === track.id;

            return (
              <div
                key={track.id}
                className={`flex items-center gap-3 px-6 py-3.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                  index !== tracks.length - 1 ? "border-b border-border" : ""
                } ${currentTrackIndex === index ? "bg-primary/5" : ""}`}
                onClick={() => (isPurchased ? playTrack(index) : togglePreview(track.id))}
              >
                {/* Play button */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    (isPurchased && currentTrackIndex === index) ||
                    (!isPurchased && previewTrack === track.id && isPlaying)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {previewLoading && !isPurchased ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (isPurchased && currentTrackIndex === index && isPlaying) ||
                    (!isPurchased && previewTrack === track.id && isPlaying) ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-foreground text-sm truncate">{track.title}</p>
                    {isPurchased && isTrackSaved && (
                      <CloudOff className="w-3 h-3 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDuration(track.duration_seconds)}</span>
                    {!isPurchased && (
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Förhandslyssning
                      </span>
                    )}
                  </div>
                  {!isPurchased && previewTrack === track.id && (
                    <div className="mt-1.5">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(previewProgress / 90) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Offline button */}
                {isPurchased && track.file_path && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 w-9 h-9"
                    onClick={(e) =>
                      isTrackSaved ? handleRemoveOffline(e, track.id) : handleSaveOffline(e, track)
                    }
                    disabled={isSaving}
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

                {!isPurchased && <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </div>
            );
          })}
        </motion.div>

        {/* Features */}
        {!isPurchased && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-4 bg-muted/50 rounded-2xl p-6 space-y-3"
          >
            <h3 className="font-semibold text-foreground text-sm">Inkluderat:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" /> Livstidsåtkomst till alla spår
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" /> Offline-lyssning på mobil
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" /> Streama på alla enheter
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" /> Professionellt producerat ljud
              </li>
            </ul>
          </motion.div>
        )}

        <div className="h-6" />
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobileProgramDetail;
