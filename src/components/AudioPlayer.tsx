import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerProps {
  title: string;
  artist?: string;
  audioUrl?: string;
  coverImage?: string;
  duration?: number;
  subtitle?: string;
  onSkipPrev?: () => void;
  onSkipNext?: () => void;
  canSkipPrev?: boolean;
  canSkipNext?: boolean;
  onEnded?: () => void;
}

const BAR_COUNT = 24;

const AudioPlayer = ({ 
  title, 
  artist = "Mentalträning", 
  audioUrl,
  coverImage = "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&auto=format&fit=crop",
  duration: initialDuration = 180,
  subtitle,
  onSkipPrev,
  onSkipNext,
  canSkipPrev = true,
  canSkipNext = true,
  onEnded,
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(20));
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Reset state when audioUrl changes (new track)
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setBars(Array(BAR_COUNT).fill(20));
  }, [audioUrl]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Set up Web Audio API analyser
  const setupAnalyser = useCallback(() => {
    if (!audioRef.current || sourceRef.current) return;
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceRef.current = source;
      analyserRef.current = analyser;
    } catch {
      // Web Audio not supported
    }
  }, []);

  // Animate bars from analyser data
  useEffect(() => {
    if (!isPlaying || !analyserRef.current) {
      if (!isPlaying) setBars(Array(BAR_COUNT).fill(20));
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.max(1, Math.floor(dataArray.length / BAR_COUNT));
      const newBars: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = dataArray[Math.min(i * step, dataArray.length - 1)] || 0;
        newBars.push(Math.max(15, (val / 255) * 100));
      }
      setBars(newBars);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  // Demo: Progress simulation when no audio URL
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !audioUrl) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration, audioUrl]);

  // Register Media Session API for background playback on mobile
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: subtitle || artist,
      album: artist,
      artwork: coverImage ? [
        { src: coverImage, sizes: '256x256', type: 'image/jpeg' },
        { src: coverImage, sizes: '512x512', type: 'image/jpeg' },
      ] : [],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play();
      setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('previoustrack', canSkipPrev ? () => onSkipPrev?.() : null);
    navigator.mediaSession.setActionHandler('nexttrack', canSkipNext ? () => onSkipNext?.() : null);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (audioRef.current && details.seekTime != null) {
        audioRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
  }, [title, artist, subtitle, coverImage, canSkipPrev, canSkipNext, onSkipPrev, onSkipNext]);

  // Update Media Session position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !isPlaying) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: duration || 0,
        playbackRate: 1,
        position: Math.min(currentTime, duration || 0),
      });
    } catch {
      // Some browsers don't support setPositionState
    }
  }, [currentTime, duration, isPlaying]);

  // Wake Lock: keep screen on while audio is playing
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Wake Lock request failed (e.g. low battery, tab not visible)
      }
    };

    if (isPlaying) {
      requestWakeLock();
      // Re-acquire wake lock when tab becomes visible again
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && isPlaying) {
          requestWakeLock();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        wakeLockRef.current?.release();
        wakeLockRef.current = null;
      };
    } else {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    }
  }, [isPlaying]);

  // Sync audio element events to state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl, onEnded]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        setupAnalyser();
        if (audioContextRef.current?.state === "suspended") {
          audioContextRef.current.resume();
        }
        audioRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (audioRef.current) {
      audioRef.current.volume = value[0] / 100;
    }
    if (value[0] === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
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

  return (
    <div className="bg-card rounded-2xl shadow-elegant p-6 space-y-6">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />}
      
      {/* Track Info */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          <img src={coverImage} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <h4 className="font-display font-semibold text-foreground truncate">{title}</h4>
          <p className="text-sm text-muted-foreground">{subtitle || artist}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration}
          step={1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Volume */}
        <div className="flex items-center gap-2 w-32">
          <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground transition-colors">
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
            className="cursor-pointer"
          />
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-foreground"
            onClick={onSkipPrev}
            disabled={!canSkipPrev}
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button 
            variant="play" 
            size="iconLg" 
            onClick={togglePlay}
            className="shadow-glow"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-foreground"
            onClick={onSkipNext}
            disabled={!canSkipNext}
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        {/* Spacer */}
        <div className="w-32" />
      </div>

      {/* Audio Visualizer */}
      <div className="flex items-end justify-center gap-1 h-8">
        {bars.map((height, i) => (
          <div
            key={i}
            className="w-1 bg-primary/40 rounded-full transition-all duration-75"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export default AudioPlayer;
