import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Search, ChevronsUpDown, X, Music, Upload, ImagePlus, Loader2, FileText, Copy } from "lucide-react";
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
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [duplicateProgram, setDuplicateProgram] = useState<Program | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    short_description: "",
    price: 0,
    image_url: "",
    pdf_file_path: "" as string | null,
    is_active: true,
    categories: [] as string[],
    country: "SE",
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
      toast.success("Produkt skapad!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Kunde inte skapa produkten: " + error.message);
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
      toast.success("Produkt uppdaterad!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Kunde inte uppdatera produkten: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("programs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
      toast.success("Produkt raderad!");
    },
    onError: (error) => {
      toast.error("Kunde inte radera produkten: " + error.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ source, newTitle }: { source: Program; newTitle: string }) => {
      const newSlug = generateSlug(newTitle) + '-' + Date.now().toString(36);
      const { error } = await supabase.from("programs").insert([{
        title: newTitle,
        slug: newSlug,
        description: source.description,
        short_description: source.short_description,
        price: source.price,
        image_url: source.image_url,
        pdf_file_path: source.pdf_file_path,
        is_active: false,
        categories: source.categories,
        country: source.country,
        duration_text: source.duration_text,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
      toast.success("Programmet duplicerat!");
      setIsDuplicateDialogOpen(false);
      setDuplicateProgram(null);
      setDuplicateTitle("");
    },
    onError: (error) => {
      toast.error("Kunde inte duplicera: " + error.message);
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
      pdf_file_path: null,
      is_active: true,
      categories: [],
      country: "SE",
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
      pdf_file_path: (program as any).pdf_file_path || null,
      is_active: program.is_active,
      categories: program.categories || [],
      country: (program as any).country || "SE",
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

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress("Läser CSV-fil...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Du måste vara inloggad");
        return;
      }

      const csvContent = await file.text();

      // First do a dry run
      setImportProgress("Analyserar data...");
      const dryResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-wordpress-products`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ csvContent, dryRun: true }),
        }
      );
      const dryResult = await dryResponse.json();
      if (!dryResponse.ok) throw new Error(dryResult.error);

      const { results: preview } = dryResult;
      const confirmed = confirm(
        `Förhandsgranskning:\n\n` +
        `Totalt rader: ${preview.total}\n` +
        `Nya produkter: ${preview.created}\n` +
        `Uppdateras: ${preview.updated}\n` +
        `Hoppar över: ${preview.skipped}\n\n` +
        `Vill du fortsätta med importen?`
      );

      if (!confirmed) {
        setIsImporting(false);
        setImportProgress("");
        if (csvInputRef.current) csvInputRef.current.value = "";
        return;
      }

      setImportProgress("Importerar produkter...");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-wordpress-products`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ csvContent, dryRun: false }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success(
        `Import klar! ${result.results.created} nya, ${result.results.updated} uppdaterade, ${result.results.skipped} hoppades över.` +
        (result.results.errors.length > 0 ? ` ${result.results.errors.length} fel.` : "")
      );

      queryClient.invalidateQueries({ queryKey: ["admin-programs"] });
    } catch (error: any) {
      toast.error("Import misslyckades: " + error.message);
    } finally {
      setIsImporting(false);
      setImportProgress("");
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mentala Träningsprogram</h1>
          <p className="text-muted-foreground mt-1">
            Hantera alla mentala träningsprogram
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <Button
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? importProgress || "Importerar..." : "Importera CSV"}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny produkt
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProgram ? "Redigera produkt" : "Skapa ny produkt"}
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
                <RichTextEditor
                  value={formData.description}
                  onChange={(val) =>
                    setFormData({ ...formData, description: val })
                  }
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
                <Label htmlFor="country">Språk</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Välj språk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SE">🇸🇪 Svenska</SelectItem>
                    <SelectItem value="NO">🇳🇴 Norska</SelectItem>
                    <SelectItem value="DK">🇩🇰 Danska</SelectItem>
                    <SelectItem value="FI">🇫🇮 Finska</SelectItem>
                    <SelectItem value="DE">🇩🇪 Tyska</SelectItem>
                    <SelectItem value="GB">🇬🇧 Engelska</SelectItem>
                    <SelectItem value="FR">🇫🇷 Franska</SelectItem>
                    <SelectItem value="ES">🇪🇸 Spanska</SelectItem>
                    <SelectItem value="IT">🇮🇹 Italienska</SelectItem>
                    <SelectItem value="PT">🇵🇹 Portugisiska</SelectItem>
                    <SelectItem value="NL">🇳🇱 Nederländska</SelectItem>
                    <SelectItem value="PL">🇵🇱 Polska</SelectItem>
                    <SelectItem value="RU">🇷🇺 Ryska</SelectItem>
                    <SelectItem value="TR">🇹🇷 Turkiska</SelectItem>
                    <SelectItem value="AR">🇸🇦 Arabiska</SelectItem>
                    <SelectItem value="HI">🇮🇳 Hindi</SelectItem>
                    <SelectItem value="ZH">🇨🇳 Kinesiska</SelectItem>
                    <SelectItem value="JA">🇯🇵 Japanska</SelectItem>
                    <SelectItem value="KO">🇰🇷 Koreanska</SelectItem>
                    <SelectItem value="ALL">🌍 Alla språk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produktbild</Label>
                {formData.image_url && (
                  <div className="mb-2 relative w-32 h-32">
                    <img
                      src={formData.image_url}
                      alt="Produktbild"
                      className="w-full h-full object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                      onClick={() => setFormData({ ...formData, image_url: "" })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="product-image-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const btn = e.target.parentElement?.querySelector('button');
                      if (btn) btn.setAttribute('disabled', 'true');
                      try {
                        const ext = file.name.split('.').pop();
                        const path = `${crypto.randomUUID()}.${ext}`;
                        const { error } = await supabase.storage
                          .from('product-images')
                          .upload(path, file);
                        if (error) throw error;
                        const { data: urlData } = supabase.storage
                          .from('product-images')
                          .getPublicUrl(path);
                        setFormData({ ...formData, image_url: urlData.publicUrl });
                        toast.success("Bild uppladdad");
                      } catch (err: any) {
                        toast.error("Kunde inte ladda upp bild: " + err.message);
                      } finally {
                        if (btn) btn.removeAttribute('disabled');
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('product-image-upload')?.click()}
                  >
                    <ImagePlus className="h-4 w-4 mr-2" />
                    {formData.image_url ? "Byt bild" : "Ladda upp bild"}
                  </Button>
                </div>
              </div>
              {/* PDF Upload */}
              <div>
                <Label>PDF-fil (valfritt)</Label>
                {formData.pdf_file_path && (
                  <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm truncate flex-1">PDF uppladdad</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => setFormData({ ...formData, pdf_file_path: null })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    id="product-pdf-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 20 * 1024 * 1024) {
                        toast.error("PDF-filen får inte vara större än 20 MB");
                        e.target.value = "";
                        return;
                      }
                      try {
                        const path = `pdfs/${crypto.randomUUID()}.pdf`;
                        const { error } = await supabase.storage
                          .from('product-images')
                          .upload(path, file, { contentType: 'application/pdf' });
                        if (error) throw error;
                        const { data: urlData } = supabase.storage
                          .from('product-images')
                          .getPublicUrl(path);
                        setFormData({ ...formData, pdf_file_path: urlData.publicUrl });
                        toast.success("PDF uppladdad");
                      } catch (err: any) {
                        toast.error("Kunde inte ladda upp PDF: " + err.message);
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('product-pdf-upload')?.click()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {formData.pdf_file_path ? "Byt PDF" : "Ladda upp PDF"}
                  </Button>
                </div>
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
                  {editingProgram ? "Spara ändringar" : "Skapa produkt"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök mentala träningsprogram..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredPrograms?.length || 0} mentala träningsprogram
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
                        title="Redigera"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDuplicateProgram(program);
                          setDuplicateTitle(program.title + " (kopia)");
                          setIsDuplicateDialogOpen(true);
                        }}
                        title="Duplicera"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Är du säker på att du vill radera denna produkt?")) {
                            deleteMutation.mutate(program.id);
                          }
                        }}
                        title="Radera"
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
