import { useState } from "react";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Music } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AudioFile = Tables<"audio_files">;

const AdminAudio = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProgramId, setFilterProgramId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudioFile | null>(null);
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
      const { data, error } = await supabase
        .from("audio_files")
        .select(`
          *,
          programs (title)
        `)
        .order("program_id")
        .order("track_order");

      if (error) throw error;
      return data;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAudio) {
      updateMutation.mutate({ id: editingAudio.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredAudioFiles = audioFiles?.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.programs as any)?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProgram =
      filterProgramId === "all" || a.program_id === filterProgramId;
    return matchesSearch && matchesProgram;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ljudfiler</h1>
          <p className="text-muted-foreground mt-1">
            Hantera ljudfiler för alla program
          </p>
        </div>
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
                <Label htmlFor="file_path">Filsökväg</Label>
                <Input
                  id="file_path"
                  value={formData.file_path}
                  onChange={(e) =>
                    setFormData({ ...formData, file_path: e.target.value })
                  }
                  placeholder="audio/program-1/track-1.mp3"
                  required
                />
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
                  <Label htmlFor="duration_seconds">Längd (sekunder)</Label>
                  <Input
                    id="duration_seconds"
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
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingAudio ? "Spara ändringar" : "Lägg till"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök ljudfiler..."
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
              {filteredAudioFiles?.length || 0} ljudfiler
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
                  <TableHead>Spår</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Längd</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudioFiles?.map((audio) => (
                  <TableRow key={audio.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-muted-foreground" />
                        {audio.track_order}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{audio.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(audio.programs as any)?.title || "-"}
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
