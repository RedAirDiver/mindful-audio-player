import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2,
  Ban,
  DollarSign,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
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
}

const AdminAffiliates = () => {
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingRate, setEditingRate] = useState<{ id: string; rate: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setCommissions((commRes.data || []) as CommissionRow[]);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("affiliates").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Status uppdaterad till ${status === "approved" ? "Godkänd" : "Pausad"}`);
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

  const getCommissionsForAffiliate = (affiliateId: string) =>
    commissions.filter((c) => c.affiliate_id === affiliateId);

  const getPendingTotal = (affiliateId: string) =>
    getCommissionsForAffiliate(affiliateId)
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + Number(c.amount), 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="font-display text-2xl font-semibold text-foreground">Affiliates</h1>

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
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 font-medium">Kod</th>
                <th className="px-4 py-3 font-medium">Namn</th>
                <th className="px-4 py-3 font-medium">E-post</th>
                <th className="px-4 py-3 font-medium">Provision %</th>
                <th className="px-4 py-3 font-medium">Väntande</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isExpanded = expandedId === a.id;
                const affCommissions = getCommissionsForAffiliate(a.id);
                const pendingTotal = getPendingTotal(a.id);

                return (
                  <>
                    <tr
                      key={a.id}
                      className={`border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? "bg-muted/30" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    >
                      <td className="px-4 py-3">
                        {affCommissions.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.referral_code}</td>
                      <td className="px-4 py-3">{a.profile_name || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.profile_email || "–"}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {editingRate?.id === a.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              className="w-20 h-8"
                              value={editingRate.rate}
                              onChange={(e) => setEditingRate({ ...editingRate, rate: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && saveRate(a.id)}
                              autoFocus
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
                        {pendingTotal > 0 ? (
                          <span className="font-medium text-amber-600">{pendingTotal.toFixed(0)} kr</span>
                        ) : (
                          <span className="text-muted-foreground">0 kr</span>
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
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {a.status !== "approved" && (
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, "approved")} title="Godkänn">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {a.status !== "rejected" && a.status !== "suspended" && (
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, "suspended")} title="Pausa">
                              <Ban className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${a.id}-details`} className="bg-muted/20">
                        <td colSpan={8} className="px-8 py-4">
                          {affCommissions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Inga provisioner ännu</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-muted-foreground text-xs">
                                  <th className="pb-2 font-medium">Datum</th>
                                  <th className="pb-2 font-medium">Belopp</th>
                                  <th className="pb-2 font-medium">Status</th>
                                  <th className="pb-2 font-medium">Åtgärd</th>
                                </tr>
                              </thead>
                              <tbody>
                                {affCommissions.map((c) => (
                                  <tr key={c.id} className="border-t border-border/50">
                                    <td className="py-2">{new Date(c.created_at).toLocaleDateString("sv-SE")}</td>
                                    <td className="py-2 font-medium">{Number(c.amount).toFixed(0)} kr</td>
                                    <td className="py-2">
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
                                    <td className="py-2">
                                      {c.status === "pending" && (
                                        <Button size="sm" variant="ghost" onClick={() => markCommissionPaid(c.id)}>
                                          <DollarSign className="w-4 h-4 mr-1" />
                                          Markera betald
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    Inga affiliates hittade
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAffiliates;
