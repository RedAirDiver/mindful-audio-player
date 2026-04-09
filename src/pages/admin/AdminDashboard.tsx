import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Music, ShoppingCart, Users } from "lucide-react";

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [programs, audioFiles, purchases, profiles] = await Promise.all([
        supabase.from("programs").select("*", { count: "exact", head: true }),
        supabase.from("audio_files").select("*", { count: "exact", head: true }),
        supabase.from("purchases").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);

      return {
        programs: programs.count || 0,
        audioFiles: audioFiles.count || 0,
        purchases: purchases.count || 0,
        users: profiles.count || 0,
      };
    },
  });

  const { data: recentPurchases } = useQuery({
    queryKey: ["admin-recent-purchases"],
    queryFn: async () => {
      const { data: purchases, error } = await supabase
        .from("purchases")
        .select(`*, programs (title)`)
        .order("purchase_date", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!purchases || purchases.length === 0) return [];

      const userIds = [...new Set(purchases.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, name")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return purchases.map((p: any) => ({ ...p, profile: profileMap.get(p.user_id) }));
    },
  });

  const statCards = [
    { label: "Mentala Träningsprogram", value: stats?.programs || 0, icon: Package, color: "text-primary" },
    { label: "Ljudfiler", value: stats?.audioFiles || 0, icon: Music, color: "text-accent" },
    { label: "Köp", value: stats?.purchases || 0, icon: ShoppingCart, color: "text-green-600" },
    { label: "Användare", value: stats?.users || 0, icon: Users, color: "text-blue-600" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Översikt</h1>
        <p className="text-muted-foreground mt-1">Välkommen till adminpanelen</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Purchases */}
      <Card>
        <CardHeader>
          <CardTitle>Senaste köpen</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPurchases && recentPurchases.length > 0 ? (
            <div className="space-y-4">
              {recentPurchases.map((purchase: any) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{purchase.programs?.title || "Okänd produkt"}</p>
                    <p className="text-sm text-muted-foreground">
                      {purchase.profiles?.email || purchase.profiles?.name || "Okänd användare"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{purchase.amount_paid} kr</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(purchase.purchase_date).toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Inga köp ännu</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
