import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerProps {
  title: string;
  artist?: string;
  audioUrl?: string;
  coverImage?: string;
}

const AudioPlayer = ({ 
  title, 
  artist = "Mentalträning", 
  audioUrl,
  coverImage = "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&auto=format&fit=crop"
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180); // Demo: 3 minutes
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
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
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}
      
      {/* Track Info */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
          <img src={coverImage} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <h4 className="font-display font-semibold text-foreground truncate">{title}</h4>
          <p className="text-sm text-muted-foreground">{artist}</p>
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
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
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
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        {/* Spacer */}
        <div className="w-32" />
      </div>

      {/* Audio Visualizer (decorative) */}
      <div className="flex items-end justify-center gap-1 h-8">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className={`w-1 bg-primary/30 rounded-full transition-all duration-150 ${
              isPlaying ? 'animate-wave' : ''
            }`}
            style={{
              height: isPlaying ? `${20 + Math.random() * 60}%` : '20%',
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default AudioPlayer;
