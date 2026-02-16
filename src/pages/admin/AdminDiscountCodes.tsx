import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  usage_limit: number | null;
  times_used: number;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

const emptyForm = {
  code: "",
  discount_type: "percentage" as string,
  discount_value: "",
  is_active: true,
  usage_limit: "",
  valid_from: "",
  valid_until: "",
};

const AdminDiscountCodes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: codes, isLoading } = useQuery({
    queryKey: ["discount-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DiscountCode[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase().trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        is_active: form.is_active,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("discount_codes")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("discount_codes")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? "Rabattkod uppdaterad" : "Rabattkod skapad" });
    },
    onError: (err: any) => {
      toast({
        title: "Fel",
        description: err.message || "Kunde inte spara rabattkoden",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("discount_codes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
      toast({ title: "Rabattkod borttagen" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("discount_codes")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openEdit = (code: DiscountCode) => {
    setEditingId(code.id);
    setForm({
      code: code.code,
      discount_type: code.discount_type,
      discount_value: String(code.discount_value),
      is_active: code.is_active,
      usage_limit: code.usage_limit ? String(code.usage_limit) : "",
      valid_from: code.valid_from ? code.valid_from.slice(0, 10) : "",
      valid_until: code.valid_until ? code.valid_until.slice(0, 10) : "",
    });
    setDialogOpen(true);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDiscount = (type: string, value: number) => {
    return type === "percentage" ? `${value}%` : `${value} kr`;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rabattkoder</h1>
          <p className="text-muted-foreground mt-1">
            Skapa och hantera rabattkoder för dina mentala program
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Ny rabattkod
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Redigera rabattkod" : "Skapa rabattkod"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="code">Kod</Label>
                <Input
                  id="code"
                  placeholder="T.ex. SOMMAR20"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  required
                  className="uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rabattyp</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Procent (%)</SelectItem>
                      <SelectItem value="fixed">Fast belopp (SEK)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_value">Värde</Label>
                  <Input
                    id="discount_value"
                    type="number"
                    min="0"
                    step="1"
                    placeholder={form.discount_type === "percentage" ? "Ex: 20" : "Ex: 100"}
                    value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usage_limit">Användningsgräns (valfritt)</Label>
                <Input
                  id="usage_limit"
                  type="number"
                  min="1"
                  placeholder="Obegränsat om tomt"
                  value={form.usage_limit}
                  onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valid_from">Giltig från</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Giltig till</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label htmlFor="is_active">Aktiv</Label>
              </div>

              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Sparar..." : editingId ? "Uppdatera" : "Skapa"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Laddar...</p>
          ) : !codes?.length ? (
            <p className="text-muted-foreground py-8 text-center">Inga rabattkoder ännu.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Rabatt</TableHead>
                  <TableHead>Använd</TableHead>
                  <TableHead>Giltig till</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{code.code}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyCode(code.code, code.id)}
                        >
                          {copiedId === code.id ? (
                            <Check className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{formatDiscount(code.discount_type, code.discount_value)}</TableCell>
                    <TableCell>
                      {code.times_used}
                      {code.usage_limit ? ` / ${code.usage_limit}` : ""}
                    </TableCell>
                    <TableCell>
                      {code.valid_until
                        ? new Date(code.valid_until).toLocaleDateString("sv-SE")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={code.is_active}
                        onCheckedChange={(v) =>
                          toggleActiveMutation.mutate({ id: code.id, is_active: v })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(code)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Vill du ta bort denna rabattkod?")) {
                              deleteMutation.mutate(code.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

export default AdminDiscountCodes;
