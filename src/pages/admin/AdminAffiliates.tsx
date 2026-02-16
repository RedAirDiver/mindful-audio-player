import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CheckCircle2,
  Ban,
  DollarSign,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Save,
  Pencil,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface EditForm {
  referral_code: string;
  commission_rate: string;
  status: string;
  payout_method: string;
  payout_details: string;
}

const AdminAffiliates = () => {
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

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

  const startEditing = (a: AffiliateRow) => {
    setEditingId(a.id);
    setEditForm({
      referral_code: a.referral_code,
      commission_rate: String(a.commission_rate),
      status: a.status,
      payout_method: a.payout_method || "",
      payout_details: a.payout_details || "",
    });
    setExpandedId(a.id);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveAffiliate = async (id: string) => {
    if (!editForm) return;
    const rate = parseFloat(editForm.commission_rate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Ange en giltig procentsats (0-100)");
      return;
    }
    if (!editForm.referral_code.trim()) {
      toast.error("Affiliate-koden kan inte vara tom");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("affiliates")
      .update({
        referral_code: editForm.referral_code.trim().toLowerCase(),
        commission_rate: rate,
        status: editForm.status,
        payout_method: editForm.payout_method.trim() || null,
        payout_details: editForm.payout_details.trim() || null,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        toast.error("Den affiliate-koden är redan tagen");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Affiliate uppdaterad");
      setEditingId(null);
      setEditForm(null);
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

  const statusLabel = (s: string) => {
    switch (s) {
      case "approved": return "Godkänd";
      case "pending": return "Väntande";
      case "rejected": return "Nekad";
      case "suspended": return "Pausad";
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "bg-primary/10 text-primary";
      case "pending": return "bg-amber-500/10 text-amber-600";
      default: return "bg-destructive/10 text-destructive";
    }
  };

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
                const isEditing = editingId === a.id;

                return (
                  <>
                    <tr
                      key={a.id}
                      className={`border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? "bg-muted/30" : ""}`}
                      onClick={() => {
                        if (isExpanded && !isEditing) {
                          setExpandedId(null);
                        } else {
                          setExpandedId(a.id);
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.referral_code}</td>
                      <td className="px-4 py-3">{a.profile_name || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.profile_email || "–"}</td>
                      <td className="px-4 py-3">{a.commission_rate}%</td>
                      <td className="px-4 py-3">
                        {pendingTotal > 0 ? (
                          <span className="font-medium text-amber-600">{pendingTotal.toFixed(0)} kr</span>
                        ) : (
                          <span className="text-muted-foreground">0 kr</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>
                          {statusLabel(a.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => startEditing(a)} title="Redigera">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${a.id}-details`} className="bg-muted/20">
                        <td colSpan={8} className="px-8 py-6">
                          <div className="space-y-6">
                            {/* Edit form */}
                            {isEditing && editForm && (
                              <div className="bg-background border border-border rounded-lg p-5 space-y-4">
                                <h3 className="font-display text-base font-semibold text-foreground">Redigera affiliate</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Affiliate-kod</Label>
                                    <Input
                                      value={editForm.referral_code}
                                      readOnly
                                      className="bg-muted cursor-not-allowed"
                                    />
                                    <p className="text-xs text-muted-foreground">Koden kan inte ändras</p>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Provision %</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={0.1}
                                      value={editForm.commission_rate}
                                      onChange={(e) => setEditForm({ ...editForm, commission_rate: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Status</Label>
                                    <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Väntande</SelectItem>
                                        <SelectItem value="approved">Godkänd</SelectItem>
                                        <SelectItem value="suspended">Pausad</SelectItem>
                                        <SelectItem value="rejected">Nekad</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs">Utbetalningsmetod</Label>
                                    <Input
                                      value={editForm.payout_method}
                                      onChange={(e) => setEditForm({ ...editForm, payout_method: e.target.value })}
                                      placeholder="T.ex. PayPal, Bank"
                                      maxLength={100}
                                    />
                                  </div>
                                  <div className="space-y-1.5 sm:col-span-2">
                                    <Label className="text-xs">Utbetalningsdetaljer</Label>
                                    <Input
                                      value={editForm.payout_details}
                                      onChange={(e) => setEditForm({ ...editForm, payout_details: e.target.value })}
                                      placeholder="Kontonummer, e-post etc."
                                      maxLength={255}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <Button size="sm" onClick={() => saveAffiliate(a.id)} disabled={saving}>
                                    <Save className="w-4 h-4 mr-1" />
                                    {saving ? "Sparar..." : "Spara"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEditing}>
                                    Avbryt
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Quick actions when not editing */}
                            {!isEditing && (
                              <div className="flex items-center gap-2 text-sm">
                                {a.status !== "approved" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      supabase.from("affiliates").update({ status: "approved" }).eq("id", a.id).then(({ error }) => {
                                        if (error) toast.error(error.message);
                                        else { toast.success("Godkänd"); fetchData(); }
                                      });
                                    }}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1 text-primary" />
                                    Godkänn
                                  </Button>
                                )}
                                {a.status !== "suspended" && a.status !== "rejected" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      supabase.from("affiliates").update({ status: "suspended" }).eq("id", a.id).then(({ error }) => {
                                        if (error) toast.error(error.message);
                                        else { toast.success("Pausad"); fetchData(); }
                                      });
                                    }}
                                  >
                                    <Ban className="w-4 h-4 mr-1 text-destructive" />
                                    Pausa
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => startEditing(a)}>
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Redigera
                                </Button>
                              </div>
                            )}

                            {/* Info summary */}
                            {!isEditing && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground block text-xs">Utbetalningsmetod</span>
                                  <span className="font-medium">{a.payout_method || "–"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs">Utbetalningsdetaljer</span>
                                  <span className="font-medium">{a.payout_details || "–"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs">Skapad</span>
                                  <span className="font-medium">{new Date(a.created_at).toLocaleDateString("sv-SE")}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs">User ID</span>
                                  <span className="font-mono text-xs">{a.user_id.slice(0, 8)}…</span>
                                </div>
                              </div>
                            )}

                            {/* Commissions */}
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-2">Provisioner</h4>
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
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                            c.status === "paid"
                                              ? "bg-primary/10 text-primary"
                                              : c.status === "cancelled"
                                              ? "bg-destructive/10 text-destructive"
                                              : "bg-amber-500/10 text-amber-600"
                                          }`}>
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
                            </div>
                          </div>
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
