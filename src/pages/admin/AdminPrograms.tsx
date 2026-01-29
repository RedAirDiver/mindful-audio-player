import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ChevronsUpDown, X, Music } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { ProgramAudioManager } from "@/components/admin/ProgramAudioManager";

type Program = Tables<"programs">;

interface Category {
  id: string;
  name: string;
  slug: string;
}

const AdminPrograms = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    short_description: "",
    price: 0,
    image_url: "",
    is_active: true,
    categories: [] as string[],
  });

  const { data: programs, isLoading } = useQuery({
    queryKey: ["admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("title");

      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("programs").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
      toast.success("Program skapat!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Kunde inte skapa programmet: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("programs")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
      toast.success("Program uppdaterat!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Kunde inte uppdatera programmet: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("programs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
      toast.success("Program raderat!");
    },
    onError: (error) => {
      toast.error("Kunde inte radera programmet: " + error.message);
    },
  });

  // Generate slug from title
  const generateSlug = (title: string): string => {
    let slug = title.toLowerCase();
    slug = slug.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
    slug = slug.replace(/[^a-z0-9]+/g, '-');
    slug = slug.replace(/^-|-$/g, '');
    return slug;
  };

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      description: "",
      short_description: "",
      price: 0,
      image_url: "",
      is_active: true,
      categories: [],
    });
    setEditingProgram(null);
  };

  const handleEdit = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      title: program.title,
      slug: program.slug,
      description: program.description || "",
      short_description: program.short_description || "",
      price: program.price,
      image_url: program.image_url || "",
      is_active: program.is_active,
      categories: program.categories || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-generate slug if not provided
    const dataWithSlug = {
      ...formData,
      slug: formData.slug || generateSlug(formData.title) + '-' + Date.now().toString(36)
    };
    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, data: dataWithSlug });
    } else {
      createMutation.mutate(dataWithSlug);
    }
  };

  const filteredPrograms = programs?.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Program</h1>
          <p className="text-muted-foreground mt-1">
            Hantera alla mentala träningsprogram
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nytt program
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProgram ? "Redigera program" : "Skapa nytt program"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="short_description">Kort beskrivning</Label>
                <Input
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) =>
                    setFormData({ ...formData, short_description: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="description">Fullständig beskrivning</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Pris (kr)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: Number(e.target.value) })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Kategorier</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {formData.categories.length > 0
                          ? `${formData.categories.length} valda`
                          : "Välj kategorier..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-2 bg-popover" align="start">
                      <div className="space-y-2">
                        {categories?.map((category) => (
                          <div
                            key={category.id}
                            className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => {
                              const isSelected = formData.categories.includes(category.name);
                              setFormData({
                                ...formData,
                                categories: isSelected
                                  ? formData.categories.filter((c) => c !== category.name)
                                  : [...formData.categories, category.name],
                              });
                            }}
                          >
                            <Checkbox
                              checked={formData.categories.includes(category.name)}
                              onCheckedChange={(checked) => {
                                setFormData({
                                  ...formData,
                                  categories: checked
                                    ? [...formData.categories, category.name]
                                    : formData.categories.filter((c) => c !== category.name),
                                });
                              }}
                            />
                            <span className="text-sm">{category.name}</span>
                          </div>
                        ))}
                        {(!categories || categories.length === 0) && (
                          <p className="text-sm text-muted-foreground p-2">
                            Inga kategorier skapade ännu
                          </p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {formData.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.categories.map((cat) => (
                        <Badge
                          key={cat}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              categories: formData.categories.filter((c) => c !== cat),
                            })
                          }
                        >
                          {cat}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="image_url">Bild-URL</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={formData.image_url}
                  onChange={(e) =>
                    setFormData({ ...formData, image_url: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Aktivt (synligt för kunder)</Label>
              </div>

              {/* Audio files section - only show when editing existing program */}
              {editingProgram && (
                <div className="border-t pt-4 mt-4">
                  <ProgramAudioManager 
                    programId={editingProgram.id} 
                    programTitle={editingProgram.title} 
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Avbryt
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProgram ? "Spara ändringar" : "Skapa program"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredPrograms?.length || 0} program
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
                  <TableHead>Titel</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Pris</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms?.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">{program.title}</TableCell>
                    <TableCell>
                      {program.categories?.join(", ") || "-"}
                    </TableCell>
                    <TableCell>{program.price} kr</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          program.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {program.is_active ? "Aktivt" : "Inaktivt"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(program)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Är du säker på att du vill radera detta program?")) {
                            deleteMutation.mutate(program.id);
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

export default AdminPrograms;
