import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

const AdminLoginHistory = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-login-history", search, page],
    queryFn: async () => {
      let query = supabase
        .from("login_history")
        .select("*", { count: "exact" })
        .order("logged_in_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.ilike("email", `%${search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Inloggningshistorik</h1>
        <p className="text-muted-foreground mt-1">
          {data?.total ?? "–"} inloggningar totalt
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på e-post..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Laddar...</p>
          ) : data?.rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Inga inloggningar hittades</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground">Tidpunkt</th>
                      <th className="pb-3 font-medium text-muted-foreground">E-post</th>
                      <th className="pb-3 font-medium text-muted-foreground">Metod</th>
                      <th className="pb-3 font-medium text-muted-foreground">Webbläsare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row: any) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-3 whitespace-nowrap">
                          {new Date(row.logged_in_at).toLocaleString("sv-SE")}
                        </td>
                        <td className="py-3">{row.email || "–"}</td>
                        <td className="py-3 capitalize">{row.login_method || "–"}</td>
                        <td className="py-3 text-xs text-muted-foreground max-w-xs truncate">
                          {row.user_agent ? row.user_agent.substring(0, 80) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Sida {page + 1} av {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLoginHistory;
