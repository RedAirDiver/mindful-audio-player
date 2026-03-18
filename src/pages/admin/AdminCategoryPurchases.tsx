import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Package } from "lucide-react";

const AdminCategoryPurchases = ({ embedded = false }: { embedded?: boolean }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: programs } = useQuery({
    queryKey: ["admin-programs-with-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, title, categories, price");
      if (error) throw error;
      return data;
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["admin-all-purchases-with-users"],
    queryFn: async () => {
      // Fetch in batches to handle >1000 rows
      let allPurchases: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("purchases")
          .select(`
            id,
            program_id,
            amount_paid,
            purchase_date,
            profiles!purchases_user_id_profiles_fkey (user_id, email, name)
          `)
          .range(from, from + batchSize - 1)
          .order("purchase_date", { ascending: false });

        if (error) throw error;
        allPurchases = [...allPurchases, ...(data || [])];
        hasMore = (data?.length || 0) === batchSize;
        from += batchSize;
      }

      return allPurchases;
    },
  });

  const filteredData = useMemo(() => {
    if (!programs || !purchases) return [];

    // Get program IDs that belong to selected category
    const categoryPrograms = selectedCategory === "all"
      ? programs
      : programs.filter((p) => p.categories?.includes(selectedCategory));

    const programIds = new Set(categoryPrograms.map((p) => p.id));
    const programMap = new Map(programs.map((p) => [p.id, p]));

    // Group purchases by user
    const userMap = new Map<string, {
      userId: string;
      email: string;
      name: string;
      programs: { title: string; amountPaid: number; purchaseDate: string }[];
    }>();

    for (const purchase of purchases) {
      if (!programIds.has(purchase.program_id)) continue;
      const profile = purchase.profiles as any;
      if (!profile) continue;

      const key = profile.user_id;
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: key,
          email: profile.email || "",
          name: profile.name || "",
          programs: [],
        });
      }

      const program = programMap.get(purchase.program_id);
      userMap.get(key)!.programs.push({
        title: program?.title || "Okänt program",
        amountPaid: purchase.amount_paid,
        purchaseDate: purchase.purchase_date,
      });
    }

    return Array.from(userMap.values()).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email, "sv")
    );
  }, [programs, purchases, selectedCategory]);

  const totalUsers = filteredData.length;
  const totalPurchases = filteredData.reduce((sum, u) => sum + u.programs.length, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Köp per kategori</h1>
        <p className="text-muted-foreground mt-1">
          Se vilka användare som köpt program inom en vald kategori
        </p>
      </div>

      {/* Category selector */}
      <div className="mb-6 max-w-sm">
        <label className="text-sm font-medium text-foreground mb-2 block">
          Välj kategori
        </label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Välj kategori..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla kategorier</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-md">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Användare</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Köp</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPurchases}</div>
          </CardContent>
        </Card>
      </div>

      {/* User list */}
      <Card>
        <CardContent className="p-0">
          {filteredData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Användare</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Köpta program</TableHead>
                  <TableHead className="text-right">Totalt betalt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="font-medium">
                      {user.name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.programs.map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {p.title}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {user.programs.reduce((s, p) => s + p.amountPaid, 0)} kr
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              {selectedCategory === "all"
                ? "Inga köp hittades"
                : "Inga köp i denna kategori"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCategoryPurchases;
