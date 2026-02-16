import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Ban,
  DollarSign,
  Loader2,
  Search,
} from "lucide-react";

interface AffiliateRow {
  id: string;
  user_id: string;
  referral_code: string;
  commission_rate: number;
  status: string;
  payout_method: string | null;
  payout_details: string | null;
  created_at: string;
  profile_name?: string;
  profile_email?: string;
}

interface CommissionRow {
  id: string;
  affiliate_id: string;
  amount: number;
  status: string;
  created_at: string;
  referral_code?: string;
}

const AdminAffiliates = () => {
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"affiliates" | "commissions">("affiliates");
  const [search, setSearch] = useState("");
  const [editingRate, setEditingRate] = useState<{ id: string; rate: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [affRes, commRes] = await Promise.all([
      supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
      supabase.from("commissions").select("*").order("created_at", { ascending: false }),
    ]);

    let affiliateRows = (affRes.data || []) as AffiliateRow[];

    // Fetch profile info for each affiliate
    if (affiliateRows.length > 0) {
      const userIds = affiliateRows.map((a) => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", userIds);

      if (profiles) {
        const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
        affiliateRows = affiliateRows.map((a) => ({
          ...a,
          profile_name: profileMap.get(a.user_id)?.name || "",
          profile_email: profileMap.get(a.user_id)?.email || "",
        }));
      }
    }

    setAffiliates(affiliateRows);

    // Enrich commissions with referral_code
    let commRows = (commRes.data || []) as CommissionRow[];
    if (commRows.length > 0 && affiliateRows.length > 0) {
      const affMap = new Map(affiliateRows.map((a) => [a.id, a.referral_code]));
      commRows = commRows.map((c) => ({ ...c, referral_code: affMap.get(c.affiliate_id) || "?" }));
    }
    setCommissions(commRows);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("affiliates").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Status uppdaterad till ${status}`);
      fetchData();
    }
  };

  const saveRate = async (id: string) => {
    if (!editingRate) return;
    const rate = parseFloat(editingRate.rate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Ange en giltig procentsats (0-100)");
      return;
    }
    const { error } = await supabase.from("affiliates").update({ commission_rate: rate }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Provisionssats uppdaterad");
      setEditingRate(null);
      fetchData();
    }
  };

  const markCommissionPaid = async (id: string) => {
    const { error } = await supabase
      .from("commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Markerad som betald");
      fetchData();
    }
  };

  const filtered = affiliates.filter(
    (a) =>
      a.referral_code.toLowerCase().includes(search.toLowerCase()) ||
      (a.profile_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.profile_email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-foreground">Affiliates</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("affiliates")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "affiliates" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Affiliates ({affiliates.length})
        </button>
        <button
          onClick={() => setTab("commissions")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "commissions" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Provisioner ({commissions.length})
        </button>
      </div>

      {tab === "affiliates" && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Sök affiliate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="bg-card rounded-xl shadow-elegant overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Kod</th>
                    <th className="px-4 py-3 font-medium">Namn</th>
                    <th className="px-4 py-3 font-medium">E-post</th>
                    <th className="px-4 py-3 font-medium">Provision %</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Åtgärder</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{a.referral_code}</td>
                      <td className="px-4 py-3">{a.profile_name || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.profile_email || "–"}</td>
                      <td className="px-4 py-3">
                        {editingRate?.id === a.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              className="w-20 h-8"
                              value={editingRate.rate}
                              onChange={(e) => setEditingRate({ ...editingRate, rate: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && saveRate(a.id)}
                            />
                            <Button size="sm" variant="ghost" onClick={() => saveRate(a.id)}>
                              OK
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="hover:underline"
                            onClick={() => setEditingRate({ id: a.id, rate: String(a.commission_rate) })}
                          >
                            {a.commission_rate}%
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.status === "approved"
                              ? "bg-primary/10 text-primary"
                              : a.status === "pending"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {a.status === "approved"
                            ? "Godkänd"
                            : a.status === "pending"
                            ? "Väntande"
                            : a.status === "rejected"
                            ? "Nekad"
                            : "Pausad"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {a.status !== "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus(a.id, "approved")}
                              title="Godkänn"
                            >
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {a.status !== "rejected" && a.status !== "suspended" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus(a.id, "suspended")}
                              title="Pausa"
                            >
                              <Ban className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "commissions" && (
        <div className="bg-card rounded-xl shadow-elegant overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Datum</th>
                  <th className="px-4 py-3 font-medium">Affiliate</th>
                  <th className="px-4 py-3 font-medium">Belopp</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{new Date(c.created_at).toLocaleDateString("sv-SE")}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.referral_code}</td>
                    <td className="px-4 py-3 font-medium">{Number(c.amount).toFixed(0)} kr</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === "paid"
                            ? "bg-primary/10 text-primary"
                            : c.status === "cancelled"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {c.status === "paid" ? "Utbetald" : c.status === "cancelled" ? "Avbruten" : "Väntande"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => markCommissionPaid(c.id)}>
                          <DollarSign className="w-4 h-4 mr-1" />
                          Markera betald
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {commissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      Inga provisioner ännu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAffiliates;
