import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineAudio } from "@/hooks/useOfflineAudio";
import { Headphones, ChevronRight, ArrowLeft, Download, Wifi, WifiOff, Trash2, AlertCircle, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import AudioPlayer from "@/components/AudioPlayer";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import { toast } from "sonner";
import MobileHeader from "@/components/mobile/MobileHeader";

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  track_order: number;
}

interface PurchasedProgram {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  tracks: AudioFile[];
}

const MobilePrograms = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { savedTracks, savingTrack, saveTrackOffline, removeTrackOffline, getDecryptedAudioUrl, isOnline } = useOfflineAudio();

  const [selectedProgram, setSelectedProgram] = useState<PurchasedProgram | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<AudioFile | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);

  const { data: purchasedPrograms = [], isLoading } = useQuery({
    queryKey: ["my-programs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from("purchases")
        .select("program_id, programs(id, title, description, image_url)")
        .eq("user_id", user!.id)
        .order("purchase_date", { ascending: false });

      if (error) throw error;
      if (!purchases?.length) return [];

      const programIds = purchases.map((p) => p.program_id);
      const { data: audioLinks } = await supabase
        .from("program_audio_files")
        .select("program_id, track_order, audio_files(*)")
        .in("program_id", programIds)
        .order("track_order", { ascending: true }) as any;

      // Deduplicate by program_id
      const seen = new Set<string>();
      const programs: PurchasedProgram[] = [];
      for (const purchase of purchases) {
        const program = purchase.programs as any;
        if (!program || seen.has(program.id)) continue;
        seen.add(program.id);
        const tracks = (audioLinks || [])
          .filter((l: any) => l.program_id === program.id)
          .map((l: any) => ({ ...l.audio_files, track_order: l.track_order }));
        programs.push({ ...program, tracks });
      }
      return programs;
    },
  });

  // Load audio URL when track changes
  useEffect(() => {
    const loadAudio = async () => {
      if (!selectedTrack) { setCurrentAudioUrl(null); return; }
      if (savedTracks.has(selectedTrack.id)) {
        const url = await getDecryptedAudioUrl(selectedTrack.id);
        if (url) { setCurrentAudioUrl(url); return; }
      }
      if (isOnline) {
        const { data } = await supabase.storage.from("audio-files").createSignedUrl(selectedTrack.file_path, 3600);
        if (data?.signedUrl) { setCurrentAudioUrl(data.signedUrl); return; }
      }
      setCurrentAudioUrl(null);
    };
    loadAudio();
    return () => { if (currentAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(currentAudioUrl); };
  }, [selectedTrack, savedTracks, isOnline]);

  const formatDuration = (s: number | null) => {
    if (!s) return "--:--";
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const handleTrackNav = (dir: number) => {
    if (!selectedProgram || !selectedTrack) return;
    const idx = selectedProgram.tracks.findIndex((t) => t.id === selectedTrack.id);
    const next = selectedProgram.tracks[idx + dir];
    if (next) setSelectedTrack(next);
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Detail view for a selected program
  if (selectedProgram) {
    const trackIdx = selectedTrack ? selectedProgram.tracks.findIndex((t) => t.id === selectedTrack.id) : -1;

    return (
      <div className="min-h-screen pb-32 bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-6 py-4 flex items-center gap-4">
          <button onClick={() => { setSelectedProgram(null); setSelectedTrack(null); }} className="p-1 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <span className="text-sm font-medium text-foreground truncate">{selectedProgram.title}</span>
        </header>

        <main className="max-w-2xl mx-auto px-6">
          {/* Program Hero */}
          <div className="w-full h-48 rounded-2xl overflow-hidden mb-6 bg-muted">
            {selectedProgram.image_url ? (
              <img src={selectedProgram.image_url} alt={selectedProgram.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Headphones className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Offline Banner */}
          {!isOnline && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">Du är offline – bara sparade spår fungerar.</p>
            </div>
          )}

          {/* Audio Player */}
          {selectedTrack && (
            <div className="mb-6">
              <AudioPlayer
                title={selectedTrack.title}
                audioUrl={currentAudioUrl || undefined}
                coverImage={selectedProgram.image_url || undefined}
                duration={selectedTrack.duration_seconds || 180}
                subtitle={selectedProgram.title}
                onSkipPrev={() => handleTrackNav(-1)}
                onSkipNext={() => handleTrackNav(1)}
                canSkipPrev={trackIdx > 0}
                canSkipNext={trackIdx < selectedProgram.tracks.length - 1}
                onEnded={() => handleTrackNav(1)}
              />
            </div>
          )}

          {/* Track List */}
          <div className="space-y-2">
            <h3 className="font-display text-lg font-semibold text-foreground mb-3">
              Spår ({selectedProgram.tracks.length})
            </h3>
            {selectedProgram.tracks.map((track, i) => {
              const isActive = selectedTrack?.id === track.id;
              const isSaved = savedTracks.has(track.id);
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isActive ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <button
                    onClick={() => setSelectedTrack(track)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className={`text-xs font-medium w-6 text-center ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDuration(track.duration_seconds)}</p>
                    </div>
                  </button>

                  {/* Offline toggle */}
                  <button
                    onClick={async () => {
                      if (isSaved) {
                        await removeTrackOffline(track.id);
                        toast.success("Borttaget från offline");
                      } else {
                        await saveTrackOffline(track.id, track.file_path, {
                          title: track.title,
                          duration: track.duration_seconds || 180,
                        });
                        toast.success("Sparat för offline");
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                  >
                    {isSaved ? (
                      <Trash2 className="w-4 h-4 text-destructive" />
                    ) : (
                      <Download className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </main>

        <MobileBottomNav />
      </div>
    );
  }

  // Programs list view
  return (
    <div className="min-h-screen pb-32 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md px-6 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary font-body mb-1">Ditt bibliotek</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Mina Program</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6">
        {!isOnline && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">Du är offline – bara sparade spår fungerar.</p>
          </div>
        )}

        {purchasedPrograms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">Inga program ännu</h2>
            <p className="text-sm text-muted-foreground mb-6">Utforska vårt utbud och börja din resa.</p>
            <Button onClick={() => navigate("/produkter")}>Utforska program</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {purchasedPrograms.map((program, i) => (
              <motion.button
                key={program.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  setSelectedProgram(program);
                  if (program.tracks.length > 0) setSelectedTrack(program.tracks[0]);
                }}
                className="w-full flex items-center gap-4 p-4 bg-card rounded-2xl shadow-sm text-left transition-all hover:shadow-md active:scale-[0.98]"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  {program.image_url ? (
                    <img src={program.image_url} alt={program.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Headphones className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground text-sm truncate">{program.title}</h3>
                  <p className="text-xs text-muted-foreground">{program.tracks.length} spår</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default MobilePrograms;
