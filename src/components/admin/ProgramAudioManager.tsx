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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Music, Upload, FileAudio, X, GripVertical } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AudioFile = Tables<"audio_files">;

interface ProgramAudioManagerProps {
  programId: string;
  programTitle: string;
}

export const ProgramAudioManager = ({ programId, programTitle }: ProgramAudioManagerProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudioFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    track_order: 1,
    duration_seconds: null as number | null,
  });

  const { data: audioFiles, isLoading } = useQuery({
    queryKey: ["program-audio-files", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_files")
        .select("*")
        .eq("program_id", programId)
        .order("track_order");

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; file_path: string; program_id: string; track_order: number; duration_seconds: number | null }) => {
      const { error } = await supabase.from("audio_files").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-audio-files", programId] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-files"] });
      toast.success("Ljudfil tillagd!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Kunde inte lägga till ljudfilen: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AudioFile> }) => {
      const { error } = await supabase
        .from("audio_files")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-audio-files", programId] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-files"] });
      toast.success("Ljudfil uppdaterad!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Kunde inte uppdatera ljudfilen: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (audio: AudioFile) => {
      // Delete from storage first
      if (audio.file_path) {
        await supabase.storage.from("audio-files").remove([audio.file_path]);
      }
      // Then delete from database
      const { error } = await supabase.from("audio_files").delete().eq("id", audio.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-audio-files", programId] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-files"] });
      toast.success("Ljudfil raderad!");
    },
    onError: (error) => {
      toast.error("Kunde inte radera ljudfilen: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      track_order: (audioFiles?.length || 0) + 1,
      duration_seconds: null,
    });
    setEditingAudio(null);
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
      // Auto-fill title from filename if empty
      if (!formData.title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
      }
      // Try to get duration
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

  const handleEdit = (audio: AudioFile) => {
    setEditingAudio(audio);
    setFormData({
      title: audio.title,
      track_order: audio.track_order,
      duration_seconds: audio.duration_seconds,
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, track_order: (audioFiles?.length || 0) + 1 }));
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAudio) {
        // Update existing audio file
        let updateData: Partial<AudioFile> = {
          title: formData.title,
          track_order: formData.track_order,
          duration_seconds: formData.duration_seconds,
        };

        // If a new file is selected, upload it
        if (selectedFile) {
          const filePath = await uploadFile(selectedFile);
          updateData.file_path = filePath;
          // Delete old file from storage
          if (editingAudio.file_path) {
            await supabase.storage.from("audio-files").remove([editingAudio.file_path]);
          }
        }

        updateMutation.mutate({ id: editingAudio.id, data: updateData });
      } else {
        // Create new audio file
        if (!selectedFile) {
          toast.error("Vänligen välj en ljudfil att ladda upp");
          return;
        }
        
        const filePath = await uploadFile(selectedFile);
        createMutation.mutate({
          title: formData.title,
          file_path: filePath,
          program_id: programId,
          track_order: formData.track_order,
          duration_seconds: formData.duration_seconds,
        });
      }
    } catch (error: any) {
      toast.error("Kunde inte ladda upp filen: " + error.message);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ljudfiler</h3>
          <p className="text-sm text-muted-foreground">
            {audioFiles?.length || 0} spår i detta program
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Lägg till spår
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : audioFiles && audioFiles.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Spår</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead className="w-20">Längd</TableHead>
                <TableHead className="w-24 text-right">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audioFiles.map((audio) => (
                <TableRow key={audio.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-muted-foreground" />
                      {audio.track_order}
                    </div>
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
                      onClick={() => handleEdit(audio)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Är du säker på att du vill radera denna ljudfil?")) {
                          deleteMutation.mutate(audio);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
          <Music className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            Inga ljudfiler tillagda ännu
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Lägg till första spåret
          </Button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAudio ? "Redigera ljudfil" : "Lägg till ljudfil"}
            </DialogTitle>
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
              {editingAudio && !selectedFile ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileAudio className="h-5 w-5 text-primary" />
                  <span className="text-sm flex-1 truncate">Nuvarande fil</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Byt fil
                  </Button>
                </div>
              ) : selectedFile ? (
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
                <Label htmlFor="audio-duration">Längd (sekunder)</Label>
                <Input
                  id="audio-duration"
                  type="number"
                  min="0"
                  value={formData.duration_seconds || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_seconds: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || isUploading}>
                {editingAudio ? "Spara ändringar" : "Lägg till"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
