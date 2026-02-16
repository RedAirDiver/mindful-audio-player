import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ShoppingCart, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const AdminPurchases = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProgramId, setFilterProgramId] = useState<string>("all");
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const queryClient = useQueryClient();

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

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["admin-purchases"],
    queryFn: async () => {
      const allData: any[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("purchases")
          .select(`
            *,
            programs (title),
            profiles!purchases_user_id_profiles_fkey (email, name)
          `)
          .order("purchase_date", { ascending: false })
          .range(offset, offset + PAGE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      return allData;
    },
  });

  const filteredPurchases = useMemo(() => purchases?.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      (p.profiles as any)?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.profiles as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.programs as any)?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProgram =
      filterProgramId === "all" || p.program_id === filterProgramId;
    return matchesSearch && matchesProgram;
  }) || [], [purchases, searchQuery, filterProgramId]);

  const totalRevenue = useMemo(() => filteredPurchases.reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0
  ), [filteredPurchases]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPurchases = filteredPurchases.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // Reset page when filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };
  const handleFilterChange = (val: string) => {
    setFilterProgramId(val);
    setCurrentPage(1);
  };
  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    setImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "true");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-wordpress-orders`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setImportPreview(data.results ? data : { results: data });
    } catch (err: any) {
      toast.error("Fel vid förhandsgranskning: " + err.message);
      setImportPreview(null);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    const file = pendingFileRef.current;
    if (!file) return;
    setImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", "false");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-wordpress-orders`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      toast.success(`Import klar: ${data.results.created} köp skapade`);
      if (data.results.unmatched_users > 0) {
        toast.info(`${data.results.unmatched_users} beställningar kunde inte matchas till användare`);
      }
      setImportPreview(null);
      pendingFileRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["admin-purchases"] });
    } catch (err: any) {
      toast.error("Importfel: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Köp</h1>
          <p className="text-muted-foreground mt-1">
            Översikt över alla kundköp
          </p>
        </div>
        <div>
          <input
            type="file"
            ref={fileRef}
            accept=".xml,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Bearbetar..." : "Importera beställningar (XML/CSV)"}
          </Button>
        </div>
      </div>

      {/* Import preview */}
      {importPreview && (
        <Card className="mb-8 border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Förhandsgranskning av import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Totala beställningar i filen: <strong>{importPreview.results.total_orders}</strong></p>
            <p>Matchade användare: <strong>{importPreview.results.matched_users}</strong></p>
            <p>Köp att skapa: <strong>{importPreview.results.created}</strong></p>
            <p>Dubbletter (hoppas över): <strong>{importPreview.results.skipped_duplicate}</strong></p>
            <p>Utan matchad produkt: <strong>{importPreview.results.skipped_no_product}</strong></p>
            <p>Omatchade e-postadresser: <strong>{importPreview.results.unmatched_users}</strong></p>
            <div className="flex gap-3 mt-4">
              <Button onClick={handleConfirmImport} disabled={importing}>
                {importing ? "Importerar..." : "Bekräfta import"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setImportPreview(null);
                  pendingFileRef.current = null;
                }}
              >
                Avbryt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totala köp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredPurchases.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total omsättning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalRevenue.toLocaleString("sv-SE")} kr</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Snittbelopp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filteredPurchases.length
                ? Math.round(totalRevenue / filteredPurchases.length).toLocaleString("sv-SE")
                : 0}{" "}
              kr
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på kund eller produkt..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterProgramId} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrera produkt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla produkter</SelectItem>
                {programs?.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paginatedPurchases.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kund</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead className="text-right">Belopp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        {new Date(purchase.purchase_date).toLocaleDateString("sv-SE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {(purchase.profiles as any)?.name || "Okänt namn"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(purchase.profiles as any)?.email || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{(purchase.programs as any)?.title || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(purchase.amount_paid).toLocaleString("sv-SE")} kr
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination controls */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Visar {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredPurchases.length)} av {filteredPurchases.length}</span>
                  <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="w-[80px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>per sida</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-3">
                    Sida {safePage} av {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
              <p>Inga köp hittades</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPurchases;
