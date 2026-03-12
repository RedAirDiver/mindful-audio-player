import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Music, Upload, FileAudio, X, Play, Pause, Search, Link2 } from "lucide-react";

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  track_order: number;
  program_id: string | null;
  created_at: string;
}

interface ProgramAudioLink {
  id: string;
  audio_file_id: string;
  track_order: number;
  audio_files: AudioFile;
}

interface ProgramAudioManagerProps {
  programId: string;
  programTitle: string;
}

export const ProgramAudioManager = ({ programId, programTitle }: ProgramAudioManagerProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ProgramAudioLink | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchExisting, setSearchExisting] = useState("");
  const [selectedExistingIds, setSelectedExistingIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    title: "",
    track_order: 1,
    duration_seconds: null as number | null,
  });

  // Fetch linked audio files for this program via junction table
  const { data: linkedAudio, isLoading } = useQuery({
    queryKey: ["program-audio-links", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_audio_files")
        .select("id, audio_file_id, track_order, audio_files(*)")
        .eq("program_id", programId)
        .order("track_order") as any;

      if (error) throw error;
      return (data || []) as ProgramAudioLink[];
    },
  });

  // Fetch all audio files for the "link existing" dialog
  const { data: allAudioFiles } = useQuery({
    queryKey: ["all-audio-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_files")
        .select("*")
        .order("title");

      if (error) throw error;
      return data as AudioFile[];
    },
    enabled: isLinkDialogOpen,
  });

  // Already linked audio file IDs
  const linkedIds = new Set(linkedAudio?.map((l) => l.audio_file_id) || []);

  // Filtered existing audio for search
  const filteredExisting = allAudioFiles?.filter(
    (af) =>
      !linkedIds.has(af.id) &&
      af.title.toLowerCase().includes(searchExisting.toLowerCase())
  );

  // Link existing audio files to this program
  const linkMutation = useMutation({
    mutationFn: async (audioFileIds: string[]) => {
      const nextOrder = (linkedAudio?.length || 0) + 1;
      const rows = audioFileIds.map((id, i) => ({
        program_id: programId,
        audio_file_id: id,
        track_order: nextOrder + i,
      }));
      const { error } = await supabase.from("program_audio_files").insert(rows) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-audio-links", programId] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-files"] });
      toast.success("Ljudfiler kopplade till programmet!");
      setIsLinkDialogOpen(false);
      setSelectedExistingIds(new Set());
      setSearchExisting("");
    },
    onError: (error) => {
      toast.error("Kunde inte koppla ljudfiler: " + error.message);
    },
  });

  // Upload new audio file and link it
  const uploadAndLinkMutation = useMutation({
    mutationFn: async (data: { title: string; file_path: string; track_order: number; duration_seconds: number | null }) => {
      // Create audio_files record (program_id null – standalone)
      const { data: audioFile, error: insertError } = await supabase
        .from("audio_files")
        .insert([{ title: data.title, file_path: data.file_path, program_id: programId, track_order: data.track_order, duration_seconds: data.duration_seconds }])
        .select()
        .single();
      if (insertError) throw insertError;

      // Create junction record
      const { error: linkError } = await supabase
        .from("program_audio_files")
        .insert([{ program_id: programId, audio_file_id: audioFile.id, track_order: data.track_order }]) as any;
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-audio-links", programId] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-files"] });
      queryClient.invalidateQueries({ queryKey: ["all-audio-files"] });
      toast.success("Ljudfil uppladdad och kopplad!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Kunde inte lägga till ljudfilen: " + error.message);
    },
  });

  // Update track order for a link
  const updateLinkMutation = useMutation({
    mutationFn: async ({ id, track_order }: { id: string; track_order: number }) => {
      const { error } = await supabase
        .from("program_audio_files")
        .update({ track_order })
        .eq("id", id) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-audio-links", programId] });
      toast.success("Spårnummer uppdaterat!");
      setEditingLink(null);
    },
    onError: (error) => {
      toast.error("Kunde inte uppdatera: " + error.message);
    },
  });

  // Unlink audio from this program (doesn't delete the audio file)
  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("program_audio_files")
        .delete()
        .eq("id", linkId) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-audio-links", programId] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-files"] });
      toast.success("Ljudfil bortkopplad från programmet");
    },
    onError: (error) => {
      toast.error("Kunde inte koppla bort ljudfilen: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      track_order: (linkedAudio?.length || 0) + 1,
      duration_seconds: null,
    });
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        toast.error("Vänligen välj en ljudfil (MP3, WAV, etc.)");
        return;
      }
      setSelectedFile(file);
      if (!formData.title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
      }
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        setFormData((prev) => ({
          ...prev,
          duration_seconds: Math.round(audio.duration),
        }));
        URL.revokeObjectURL(audio.src);
      };
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${programId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    setIsUploading(true);
    setUploadProgress(10);

    const { error } = await supabase.storage
      .from("audio-files")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    setUploadProgress(100);

    if (error) {
      setIsUploading(false);
      throw error;
    }

    setIsUploading(false);
    return fileName;
  };

  const handleAddNew = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, track_order: (linkedAudio?.length || 0) + 1 }));
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!selectedFile) {
        toast.error("Vänligen välj en ljudfil att ladda upp");
        return;
      }
      
      const filePath = await uploadFile(selectedFile);
      uploadAndLinkMutation.mutate({
        title: formData.title,
        file_path: filePath,
        track_order: formData.track_order,
        duration_seconds: formData.duration_seconds,
      });
    } catch (error: any) {
      toast.error("Kunde inte ladda upp filen: " + error.message);
    }
  };

  const handleLinkExisting = () => {
    if (selectedExistingIds.size === 0) {
      toast.error("Välj minst en ljudfil");
      return;
    }
    linkMutation.mutate(Array.from(selectedExistingIds));
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayTrack = async (audio: AudioFile) => {
    if (playingTrackId === audio.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("audio-files")
        .createSignedUrl(audio.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl && audioRef.current) {
        audioRef.current.src = data.signedUrl;
        audioRef.current.play();
        setPlayingTrackId(audio.id);
        setIsPlaying(true);
      }
    } catch (error: any) {
      toast.error("Kunde inte spela upp ljudfilen: " + error.message);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlayingTrackId(null);
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Program</h3>
          <p className="text-sm text-muted-foreground">
            {linkedAudio?.length || 0} spår i detta program
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsLinkDialogOpen(true)}>
            <Link2 className="h-4 w-4 mr-2" />
            Välj befintlig
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Ladda upp ny
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : linkedAudio && linkedAudio.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-16">Spår</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead className="w-20">Längd</TableHead>
                <TableHead className="w-24 text-right">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linkedAudio.map((link) => {
                const audio = link.audio_files;
                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={playingTrackId === audio.id && isPlaying ? "text-primary" : ""}
                        onClick={() => handlePlayTrack(audio)}
                      >
                        {playingTrackId === audio.id && isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {editingLink?.id === link.id ? (
                        <Input
                          type="number"
                          min="1"
                          className="w-16 h-8"
                          defaultValue={link.track_order}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== link.track_order) {
                              updateLinkMutation.mutate({ id: link.id, track_order: val });
                            } else {
                              setEditingLink(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() => setEditingLink(link)}
                        >
                          <Music className="h-4 w-4 text-muted-foreground" />
                          {link.track_order}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{audio.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(audio.duration_seconds)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="Koppla bort från programmet"
                        onClick={() => {
                          if (confirm("Koppla bort denna ljudfil från programmet? (Filen tas inte bort)")) {
                            unlinkMutation.mutate(link.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
          <Music className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            Inga spår kopplade till detta program
          </p>
          <div className="flex justify-center gap-2 mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsLinkDialogOpen(true)}>
              <Link2 className="h-4 w-4 mr-2" />
              Välj befintlig
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Ladda upp ny
            </Button>
          </div>
        </div>
      )}

      {/* Upload New Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ladda upp ny ljudfil</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="audio-title">Titel</Label>
              <Input
                id="audio-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Ljudfil</Label>
              {selectedFile ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileAudio className="h-5 w-5 text-primary" />
                  <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Klicka för att välja en ljudfil
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP3, WAV, M4A, etc.
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              {isUploading && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Laddar upp... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="audio-track-order">Spårnummer</Label>
                <Input
                  id="audio-track-order"
                  type="number"
                  min="1"
                  value={formData.track_order}
                  onChange={(e) =>
                    setFormData({ ...formData, track_order: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label>Längd</Label>
                <p className="text-sm text-muted-foreground mt-2">
                  {formData.duration_seconds
                    ? `${Math.floor(formData.duration_seconds / 60)}:${(formData.duration_seconds % 60).toString().padStart(2, "0")}`
                    : "Hämtas automatiskt"}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={uploadAndLinkMutation.isPending || isUploading}>
                Ladda upp & koppla
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Existing Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={(open) => {
        setIsLinkDialogOpen(open);
        if (!open) {
          setSelectedExistingIds(new Set());
          setSearchExisting("");
        }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Välj befintliga ljudfiler</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök ljudfiler..."
                value={searchExisting}
                onChange={(e) => setSearchExisting(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredExisting && filteredExisting.length > 0 ? (
                filteredExisting.map((af) => (
                  <div
                    key={af.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setSelectedExistingIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(af.id)) {
                          next.delete(af.id);
                        } else {
                          next.add(af.id);
                        }
                        return next;
                      });
                    }}
                  >
                    <Checkbox checked={selectedExistingIds.has(af.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{af.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(af.duration_seconds)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchExisting ? "Inga matchande ljudfiler hittades" : "Inga tillgängliga ljudfiler"}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {selectedExistingIds.size} valda
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button
                  onClick={handleLinkExisting}
                  disabled={selectedExistingIds.size === 0 || linkMutation.isPending}
                >
                  Koppla till program
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
