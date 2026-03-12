import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Music, Upload, FileAudio, X, Play, Pause, Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AudioFile = Tables<"audio_files">;

const AdminAudio = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProgramId, setFilterProgramId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudioFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    file_path: "",
    program_id: "",
    track_order: 1,
    duration_seconds: null as number | null,
  });

  const { data: programs } = useQuery({
    queryKey: ["admin-programs-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, title")
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  const { data: audioFiles, isLoading } = useQuery({
    queryKey: ["admin-audio-files"],
    queryFn: async () => {
      // Fetch all audio files
      const { data: files, error } = await supabase
        .from("audio_files")
        .select("*")
        .order("title");

      if (error) throw error;

      // Fetch junction table to know which programs each file belongs to
      const { data: links } = await supabase
        .from("program_audio_files")
        .select("audio_file_id, program_id, track_order, programs:program_id(title)")
        .order("track_order") as any;

      // Attach program info to each audio file
      const linkMap: Record<string, { programId: string; programTitle: string; trackOrder: number }[]> = {};
      (links || []).forEach((l: any) => {
        if (!linkMap[l.audio_file_id]) linkMap[l.audio_file_id] = [];
        linkMap[l.audio_file_id].push({
          programId: l.program_id,
          programTitle: (l.programs as any)?.title || "Okänt",
          trackOrder: l.track_order,
        });
      });

      return (files || []).map((f: any) => ({
        ...f,
        linkedPrograms: linkMap[f.id] || [],
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("audio_files").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
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
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("audio_files")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audio_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
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
      file_path: "",
      program_id: "",
      track_order: 1,
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

  const uploadFile = async (file: File, programId: string): Promise<string> => {
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
      file_path: audio.file_path,
      program_id: audio.program_id,
      track_order: audio.track_order,
      duration_seconds: audio.duration_seconds,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let filePath = formData.file_path;
      
      // Upload file if a new file is selected
      if (selectedFile && formData.program_id) {
        filePath = await uploadFile(selectedFile, formData.program_id);
      }
      
      const dataToSave = { ...formData, file_path: filePath };
      
      if (editingAudio) {
        updateMutation.mutate({ id: editingAudio.id, data: dataToSave });
      } else {
        if (!filePath) {
          toast.error("Vänligen välj en ljudfil att ladda upp");
          return;
        }
        createMutation.mutate(dataToSave);
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

  const filteredAudioFiles = audioFiles?.filter((a: any) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.linkedPrograms?.some((lp: any) => lp.programTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesProgram =
      filterProgramId === "all" || a.linkedPrograms?.some((lp: any) => lp.programId === filterProgramId);
    return matchesSearch && matchesProgram;
  });

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
      toast.error("Kunde inte spela upp: " + error.message);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlayingTrackId(null);
  };

  const handleXmlImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress("Laddar upp och bearbetar XML-fil...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Du måste vara inloggad");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "full");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-wordpress-media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import misslyckades");
      }

      setImportProgress("");
      if (result.total_in_xml === 0) {
        toast.warning(result.message || "Inga program hittades i XML-filen.");
      } else {
        toast.success(
          `Import klar! ${result.files_created ?? 0} nya poster, ${result.durations_updated ?? 0} längder uppdaterade, ${result.files_downloaded ?? 0} filer nedladdade, ${result.failed ?? 0} misslyckade av ${result.total_in_xml ?? 0} totalt.${result.unmatched ? ` ${result.unmatched} kunde inte kopplas till program.` : ''}`
        );
      }

      queryClient.invalidateQueries({ queryKey: ["admin-audio-files"] });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.warning("Importen tog för lång tid, men den kan fortfarande köras i bakgrunden. Ladda om sidan om en stund för att se resultatet, och kör sedan importen igen för att hämta resterande filer.");
      } else {
        toast.error("Import misslyckades: " + error.message);
      }
    } finally {
      setIsImporting(false);
      setImportProgress("");
      if (xmlInputRef.current) xmlInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Program</h1>
          <p className="text-muted-foreground mt-1">
            Hantera program för alla produkter
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={xmlInputRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={handleXmlImport}
          />
          <Button
            variant="outline"
            onClick={() => xmlInputRef.current?.click()}
            disabled={isImporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isImporting ? "Importerar..." : "Importera från WordPress XML"}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny ljudfil
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAudio ? "Redigera ljudfil" : "Lägg till ljudfil"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="program_id">Program</Label>
                <Select
                  value={formData.program_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, program_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs?.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Ljudfil</Label>
                {editingAudio && formData.file_path && !selectedFile ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileAudio className="h-5 w-5 text-primary" />
                    <span className="text-sm flex-1 truncate">{formData.file_path}</span>
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
                  <Label htmlFor="track_order">Spårnummer</Label>
                  <Input
                    id="track_order"
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
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || isUploading}>
                  {editingAudio ? "Spara ändringar" : "Lägg till"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isImporting && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-sm font-medium text-foreground">{importProgress || "Importerar..."}</p>
          </div>
          <Progress value={undefined} className="h-2 [&>div]:animate-pulse" />
          <p className="text-xs text-muted-foreground">Detta kan ta flera minuter beroende på antal filer...</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterProgramId} onValueChange={setFilterProgramId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrera program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla program</SelectItem>
                {programs?.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {filteredAudioFiles?.length || 0} program
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Spår</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Längd</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudioFiles?.map((audio: any) => (
                  <TableRow key={audio.id}>
                    <TableCell>
                      <Button
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
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-muted-foreground" />
                        {audio.linkedPrograms?.length > 0
                          ? audio.linkedPrograms.map((lp: any) => lp.trackOrder).join(", ")
                          : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {audio.title}
                      {audio.linkedPrograms?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {audio.linkedPrograms.map((lp: any) => (
                            <span key={lp.programId} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                              {lp.programTitle}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatDuration(audio.duration_seconds)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(audio)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Är du säker på att du vill radera denna ljudfil?")) {
                            deleteMutation.mutate(audio.id);
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAudio;
