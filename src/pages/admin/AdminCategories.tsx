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
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderOpen, GripVertical, EyeOff, Eye, Upload, X, Image as ImageIcon } from "lucide-react";
import AdminCategoryPurchases from "./AdminCategoryPurchases";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_hidden: boolean;
  created_at: string;
}

const AdminCategories = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    sort_order: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: programCounts } = useQuery({
    queryKey: ["admin-category-program-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("categories");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((program) => {
        if (program.categories) {
          program.categories.forEach((cat: string) => {
            counts[cat] = (counts[cat] || 0) + 1;
          });
        }
      });
      return counts;
    },
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const filePath = `categories/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(filePath, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setUploading(true);
      let image_url: string | null = null;
      if (imageFile) {
        image_url = await uploadImage(imageFile);
      }
      const { error } = await supabase.from("categories").insert([{
        name: data.name,
        slug: data.slug || generateSlug(data.name),
        description: data.description || null,
        sort_order: data.sort_order,
        image_url,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success("Kategori skapad");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Kunde inte skapa kategori: " + error.message);
    },
    onSettled: () => setUploading(false),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      setUploading(true);
      let image_url: string | null | undefined = undefined;
      if (imageFile) {
        image_url = await uploadImage(imageFile);
      }
      const updateData: Record<string, unknown> = {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        sort_order: data.sort_order,
      };
      if (image_url !== undefined) {
        updateData.image_url = image_url;
      }
      const { error } = await supabase
        .from("categories")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success("Kategori uppdaterad");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Kunde inte uppdatera kategori: " + error.message);
    },
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success("Kategori borttagen");
    },
    onError: (error) => {
      toast.error("Kunde inte ta bort kategori: " + error.message);
    },
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: async ({ id, is_hidden }: { id: string; is_hidden: boolean }) => {
      const { error } = await supabase
        .from("categories")
        .update({ is_hidden })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success("Synlighet uppdaterad");
    },
    onError: (error) => {
      toast.error("Kunde inte uppdatera synlighet: " + error.message);
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/å/g, "a")
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      sort_order: (categories?.length || 0) + 1,
    });
    setImageFile(null);
    setImagePreview(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      sort_order: category.sort_order,
    });
    setImageFile(null);
    setImagePreview(category.image_url || null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", slug: "", description: "", sort_order: 0 });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : generateSlug(name),
    }));
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Kategorier</h1>
        <p className="text-muted-foreground mt-1">
          Hantera produktkategorier och se deltagare per kategori
        </p>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList>
          <TabsTrigger value="categories">Kategorier</TabsTrigger>
          <TabsTrigger value="users">Kategorier & Användare</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <div className="flex justify-end mb-6">
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Lägg till kategori
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Antal kategorier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{categories?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Produkter med kategorier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {Object.values(programCounts || {}).reduce((a, b) => a + b, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alla kategorier</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : categories && categories.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Ordning</TableHead>
                      <TableHead className="w-16">Bild</TableHead>
                      <TableHead>Namn</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Beskrivning</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Synlighet</TableHead>
                      <TableHead className="text-right">Åtgärder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                            {category.sort_order}
                          </div>
                        </TableCell>
                        <TableCell>
                          {category.image_url ? (
                            <img src={category.image_url} alt={category.name} className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {category.slug}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {category.description || "-"}
                        </TableCell>
                        <TableCell>
                          {programCounts?.[category.name] || 0} st
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleHiddenMutation.mutate({ id: category.id, is_hidden: !category.is_hidden })}
                            title={category.is_hidden ? "Dold – klicka för att visa" : "Synlig – klicka för att dölja"}
                          >
                            {category.is_hidden ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-primary" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Vill du ta bort denna kategori?")) {
                                  deleteMutation.mutate(category.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
                  <p>Inga kategorier ännu</p>
                  <Button variant="link" onClick={openCreateDialog}>
                    Skapa din första kategori
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <AdminCategoryPurchases embedded />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Redigera kategori" : "Skapa ny kategori"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Namn</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="T.ex. Personlig Utveckling"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="personlig-utveckling"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beskrivning (valfritt)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="En kort beskrivning av kategorin..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sorteringsordning</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      sort_order: parseInt(e.target.value) || 0,
                    }))
                  }
                  min={0}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Avbryt
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingCategory ? "Spara" : "Skapa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCategories;
