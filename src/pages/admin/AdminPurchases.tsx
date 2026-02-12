import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ShoppingCart } from "lucide-react";

const AdminPurchases = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProgramId, setFilterProgramId] = useState<string>("all");

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
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          programs (title),
          profiles!purchases_user_id_fkey (email, name)
        `)
        .order("purchase_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredPurchases = purchases?.filter((p) => {
    const matchesSearch =
      (p.profiles as any)?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.profiles as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.programs as any)?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProgram =
      filterProgramId === "all" || p.program_id === filterProgramId;
    return matchesSearch && matchesProgram;
  });

  const totalRevenue = filteredPurchases?.reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0
  ) || 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Köp</h1>
        <p className="text-muted-foreground mt-1">
          Översikt över alla kundköp
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totala köp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredPurchases?.length || 0}</div>
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
              {filteredPurchases?.length
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterProgramId} onValueChange={setFilterProgramId}>
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
          ) : filteredPurchases && filteredPurchases.length > 0 ? (
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
                {filteredPurchases.map((purchase) => (
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
