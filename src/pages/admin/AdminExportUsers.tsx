import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Loader2, Users } from "lucide-react";

const AdminExportUsers = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const all: { email: string | null }[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("profiles")
          .select("email")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const escape = (val: string) => {
        const v = val.replace(/"/g, '""');
        return /[",\n\r]/.test(v) ? `"${v}"` : v;
      };

      const rows = ["E-post"];
      for (const u of all) {
        if (u.email) rows.push(escape(u.email));
      }
      const csv = "\uFEFF" + rows.join("\r\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `anvandare-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCount(all.length);
      toast.success(`Exporterade ${all.length} användare`);
    } catch (err) {
      toast.error("Export misslyckades: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Exportera användare</h1>
        <p className="text-muted-foreground mt-1">
          Ladda ner alla användare som en CSV-fil med namn och e-post.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            CSV-export
          </CardTitle>
          <CardDescription>
            Filen innehåller två kolumner: Namn och E-post. UTF-8 med BOM så att åäö visas korrekt i Excel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporterar...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Ladda ner CSV
              </>
            )}
          </Button>
          {count !== null && (
            <p className="text-sm text-muted-foreground mt-3">
              Senaste export: {count} användare
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminExportUsers;
