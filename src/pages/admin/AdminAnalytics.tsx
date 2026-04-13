import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, ShoppingCart, TrendingUp, Activity, Calendar } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const AdminAnalytics = () => {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startISO = startDate.toISOString();

  // Purchases over time
  const { data: purchaseData } = useQuery({
    queryKey: ["analytics-purchases", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("purchase_date, amount_paid, program_id, programs(title)")
        .gte("purchase_date", startISO)
        .order("purchase_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // New users over time
  const { data: userData } = useQuery({
    queryKey: ["analytics-users", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("created_at, email")
        .gte("created_at", startISO)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Login activity
  const { data: loginData } = useQuery({
    queryKey: ["analytics-logins", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_history")
        .select("logged_in_at, login_method")
        .gte("logged_in_at", startISO)
        .order("logged_in_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Group data by date
  const groupByDate = <T extends Record<string, any>>(items: T[], dateField: string) => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      const date = new Date(item[dateField]).toLocaleDateString("sv-SE");
      map.set(date, (map.get(date) || 0) + 1);
    });
    // Fill in missing dates
    const result: { date: string; count: number }[] = [];
    const d = new Date(startDate);
    const now = new Date();
    while (d <= now) {
      const key = d.toLocaleDateString("sv-SE");
      result.push({ date: key, count: map.get(key) || 0 });
      d.setDate(d.getDate() + 1);
    }
    return result;
  };

  const purchasesByDate = groupByDate(purchaseData || [], "purchase_date");
  const usersByDate = groupByDate(userData || [], "created_at");
  const loginsByDate = groupByDate(loginData || [], "logged_in_at");

  // Revenue by date
  const revenueByDate = (() => {
    const map = new Map<string, number>();
    (purchaseData || []).forEach((p: any) => {
      const date = new Date(p.purchase_date).toLocaleDateString("sv-SE");
      map.set(date, (map.get(date) || 0) + Number(p.amount_paid));
    });
    const result: { date: string; revenue: number }[] = [];
    const d = new Date(startDate);
    const now = new Date();
    while (d <= now) {
      const key = d.toLocaleDateString("sv-SE");
      result.push({ date: key, revenue: map.get(key) || 0 });
      d.setDate(d.getDate() + 1);
    }
    return result;
  })();

  // Top programs
  const topPrograms = (() => {
    const map = new Map<string, { count: number; revenue: number }>();
    (purchaseData || []).forEach((p: any) => {
      const title = p.programs?.title || "Okänd";
      const existing = map.get(title) || { count: 0, revenue: 0 };
      map.set(title, { count: existing.count + 1, revenue: existing.revenue + Number(p.amount_paid) });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  })();

  // Totals
  const totalRevenue = (purchaseData || []).reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
  const totalPurchases = purchaseData?.length || 0;
  const totalNewUsers = userData?.length || 0;
  const totalLogins = loginData?.length || 0;

  const chartConfig = {
    count: { label: "Antal", color: "hsl(var(--primary))" },
    revenue: { label: "Intäkt (kr)", color: "hsl(var(--accent))" },
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analys</h1>
          <p className="text-muted-foreground mt-1">Översikt av köp, användare och aktivitet</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
          <TabsList>
            <TabsTrigger value="7d">7 dagar</TabsTrigger>
            <TabsTrigger value="30d">30 dagar</TabsTrigger>
            <TabsTrigger value="90d">90 dagar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Intäkter</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalRevenue.toLocaleString("sv-SE")} kr</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Köp</CardTitle>
            <ShoppingCart className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalPurchases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nya användare</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalNewUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inloggningar</CardTitle>
            <Activity className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalLogins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Intäkter per dag</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={revenueByDate}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Purchases Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Köp per dag</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={purchasesByDate}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* New Users Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nya användare per dag</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={usersByDate}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Login Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inloggningar per dag</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={loginsByDate}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Programs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mest sålda program</CardTitle>
        </CardHeader>
        <CardContent>
          {topPrograms.length > 0 ? (
            <div className="space-y-3">
              {topPrograms.map((prog, i) => (
                <div key={prog.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
                    <span className="font-medium">{prog.name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-muted-foreground">{prog.count} köp</span>
                    <span className="font-medium">{prog.revenue.toLocaleString("sv-SE")} kr</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Inga köp under perioden</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
