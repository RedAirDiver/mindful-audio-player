import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/hooks/useImpersonation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Users,
  Shield,
  ShieldOff,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  ShoppingCart,
  LinkIcon,
  Save,
  Eye,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 25;

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const { startImpersonation } = useImpersonation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    user_id: string;
    name: string | null;
    email: string | null;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    company: "",
    address_line1: "",
    address_city: "",
    address_postcode: "",
    address_country: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [affEditForm, setAffEditForm] = useState<{
    userId: string;
    referral_code: string;
    commission_rate: string;
    status: string;
    payout_method: string;
    payout_details: string;
  } | null>(null);
  const [affSaving, setAffSaving] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Server-side paginated query
  const { data: profilesData, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedSearch, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (debouncedSearch) {
        query = query.or(
          `email.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`
        );
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { profiles: data, totalCount: count || 0 };
    },
  });

  const profiles = profilesData?.profiles || [];
  const totalCount = profilesData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: userRoles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: purchaseCounts } = useQuery({
    queryKey: ["admin-user-purchase-counts"],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("purchases")
          .select("user_id")
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach((p) => {
          counts[p.user_id] = (counts[p.user_id] || 0) + 1;
        });
        if (data.length < 1000) break;
        offset += 1000;
      }
      return counts;
    },
  });

  // Fetch all affiliates for mapping
  const { data: allAffiliates } = useQuery({
    queryKey: ["admin-all-affiliates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("affiliates").select("*");
      if (error) throw error;
      return data;
    },
  });

  const getAffiliateForUser = (userId: string) =>
    allAffiliates?.find((a) => a.user_id === userId) || null;

  // Fetch purchases for expanded user
  const { data: userPurchases, isLoading: loadingPurchases } = useQuery({
    queryKey: ["admin-user-purchases", expandedUserId],
    queryFn: async () => {
      if (!expandedUserId) return [];
      const { data, error } = await supabase
        .from("purchases")
        .select("*, programs (title)")
        .eq("user_id", expandedUserId)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!expandedUserId,
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("id", purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-purchases", expandedUserId] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-purchase-counts"] });
      toast.success("Köpet har raderats");
    },
    onError: (error) => {
      toast.error("Kunde inte radera köpet: " + error.message);
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({
      userId,
      isAdmin,
    }: {
      userId: string;
      isAdmin: boolean;
    }) => {
      if (isAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: "admin" }]);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success(
        variables.isAdmin
          ? "Adminbehörighet borttagen"
          : "Adminbehörighet tillagd"
      );
    },
    onError: (error) => {
      toast.error("Kunde inte ändra behörighet: " + error.message);
    },
  });

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      // Validate password match
      if (formData.password && formData.password !== formData.confirmPassword) {
        throw new Error("Lösenorden matchar inte");
      }
      if (editingUser) {
        // Update existing user
        const { data, error } = await supabase.functions.invoke("manage-user", {
          body: {
            action: "update",
            userId: editingUser.user_id,
            name: formData.name,
            email: formData.email,
            password: formData.password || undefined,
            phone: formData.phone,
            company: formData.company,
            address_line1: formData.address_line1,
            address_city: formData.address_city,
            address_postcode: formData.address_postcode,
            address_country: formData.address_country,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        // Create new user
        if (!formData.email) throw new Error("E-post krävs");
        const { data, error } = await supabase.functions.invoke("manage-user", {
          body: {
            action: "create",
            email: formData.email,
            name: formData.name,
            password: formData.password || undefined,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(editingUser ? "Användare uppdaterad" : "Användare skapad");
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isUserAdmin = (userId: string) =>
    userRoles?.some((r) => r.user_id === userId && r.role === "admin");

  const emptyForm = { name: "", email: "", password: "", confirmPassword: "", phone: "", company: "", address_line1: "", address_city: "", address_postcode: "", address_country: "" };

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEdit = (profile: (typeof profiles)[0]) => {
    setEditingUser({
      user_id: profile.user_id,
      name: profile.name,
      email: profile.email,
    });
    setFormData({
      name: profile.name || "",
      email: profile.email || "",
      password: "",
      confirmPassword: "",
      phone: (profile as any).phone || "",
      company: (profile as any).company || "",
      address_line1: (profile as any).address_line1 || "",
      address_city: (profile as any).address_city || "",
      address_postcode: (profile as any).address_postcode || "",
      address_country: (profile as any).address_country || "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData({ ...emptyForm });
    setShowPassword(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Användare</h1>
          <p className="text-muted-foreground mt-1">
            Hantera användare och behörigheter
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Skapa användare
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totalt antal användare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Administratörer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {userRoles?.filter((r) => r.role === "admin").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på namn eller e-post..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {totalCount} användare totalt
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : profiles.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Användare</TableHead>
                    <TableHead>Registrerad</TableHead>
                    <TableHead>Köp</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead className="text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const admin = isUserAdmin(profile.user_id);
                    const isExpanded = expandedUserId === profile.user_id;
                    return (
                      <Fragment key={profile.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedUserId(isExpanded ? null : profile.user_id)
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                                  isExpanded ? "rotate-0" : "-rotate-90"
                                }`}
                              />
                              <div>
                                <p className="font-medium">
                                  {profile.name || "Inget namn"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {profile.email || "-"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(profile.created_at).toLocaleDateString(
                              "sv-SE"
                            )}
                          </TableCell>
                          <TableCell>
                            {purchaseCounts?.[profile.user_id] || 0} st
                          </TableCell>
                          <TableCell>
                            {admin ? (
                              <Badge variant="default" className="bg-primary">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Användare</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(profile)}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Redigera
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startImpersonation(profile.user_id)}
                                title="Logga in som denna användare"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Visa som
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toggleAdminMutation.mutate({
                                    userId: profile.user_id,
                                    isAdmin: !!admin,
                                  })
                                }
                                disabled={toggleAdminMutation.isPending}
                              >
                                {admin ? (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-1" />
                                    Ta bort admin
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-1" />
                                    Gör till admin
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/30 p-0">
                              <div className="px-8 py-4 space-y-6">
                                {/* Affiliate Section */}
                                <AffiliateSection
                                  userId={profile.user_id}
                                  affiliate={getAffiliateForUser(profile.user_id)}
                                  editForm={affEditForm?.userId === profile.user_id ? affEditForm : null}
                                  saving={affSaving}
                                  onStartEdit={(aff) => {
                                    const defaultCode = aff?.referral_code ||
                                      (profile.name
                                        ? profile.name.trim().toLowerCase()
                                            .replace(/[åä]/g, "a").replace(/ö/g, "o")
                                            .replace(/[^a-z0-9]/g, "").slice(0, 15)
                                          + Math.floor(Math.random() * 100)
                                        : "aff" + Math.random().toString(36).slice(2, 8));
                                    setAffEditForm({
                                      userId: profile.user_id,
                                      referral_code: defaultCode,
                                      commission_rate: String(aff?.commission_rate ?? 10),
                                      status: aff?.status || "approved",
                                      payout_method: aff?.payout_method || "",
                                      payout_details: aff?.payout_details || "",
                                    });
                                  }}
                                  onCancelEdit={() => setAffEditForm(null)}
                                  onChange={(field, value) =>
                                    setAffEditForm((f) => f ? { ...f, [field]: value } : null)
                                  }
                                  onSave={async () => {
                                    if (!affEditForm) return;
                                    const rate = parseFloat(affEditForm.commission_rate);
                                    if (isNaN(rate) || rate < 0 || rate > 100) {
                                      toast.error("Ange en giltig procentsats (0-100)");
                                      return;
                                    }
                                    if (!affEditForm.referral_code.trim()) {
                                      toast.error("Affiliate-koden kan inte vara tom");
                                      return;
                                    }
                                    setAffSaving(true);
                                    const existing = getAffiliateForUser(profile.user_id);
                                    if (existing) {
                                      const { error } = await supabase
                                        .from("affiliates")
                                        .update({
                                          referral_code: affEditForm.referral_code.trim().toLowerCase(),
                                          commission_rate: rate,
                                          status: affEditForm.status,
                                          payout_method: affEditForm.payout_method.trim() || null,
                                          payout_details: affEditForm.payout_details.trim() || null,
                                        })
                                        .eq("id", existing.id);
                                      setAffSaving(false);
                                      if (error) { toast.error(error.message); return; }
                                    } else {
                                      const { error } = await supabase.from("affiliates").insert({
                                        user_id: profile.user_id,
                                        referral_code: affEditForm.referral_code.trim().toLowerCase(),
                                        commission_rate: rate,
                                        status: affEditForm.status,
                                        payout_method: affEditForm.payout_method.trim() || null,
                                        payout_details: affEditForm.payout_details.trim() || null,
                                      });
                                      setAffSaving(false);
                                      if (error) { toast.error(error.message); return; }
                                    }
                                    toast.success("Affiliate sparad");
                                    setAffEditForm(null);
                                    queryClient.invalidateQueries({ queryKey: ["admin-all-affiliates"] });
                                  }}
                                />

                                {/* Köphistorik */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                    <ShoppingCart className="h-4 w-4" />
                                    Köphistorik
                                  </h4>
                                  {loadingPurchases ? (
                                    <div className="flex justify-center py-4">
                                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : userPurchases && userPurchases.length > 0 ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Datum</TableHead>
                                          <TableHead>Produkt</TableHead>
                                          <TableHead className="text-right">Belopp</TableHead>
                                          <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {userPurchases.map((p) => (
                                          <TableRow key={p.id}>
                                            <TableCell className="text-sm">
                                              {new Date(p.purchase_date).toLocaleDateString("sv-SE")}
                                            </TableCell>
                                            <TableCell>{(p.programs as any)?.title || "-"}</TableCell>
                                            <TableCell className="text-right font-medium">
                                              {Number(p.amount_paid).toLocaleString("sv-SE")} kr
                                            </TableCell>
                                            <TableCell>
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>Radera köp</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      Är du säker på att du vill radera detta köp? Användaren förlorar åtkomst till programmet. Denna åtgärd kan inte ångras.
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                                    <AlertDialogAction
                                                      onClick={() => deletePurchaseMutation.mutate(p.id)}
                                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                      Radera
                                                    </AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <p className="text-sm text-muted-foreground py-2">Inga köp registrerade</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Sida {page + 1} av {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Föregående
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                    >
                      Nästa
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>Inga användare hittades</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Redigera användare" : "Skapa ny användare"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="user-name">Namn</Label>
              <Input
                id="user-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Förnamn Efternamn"
              />
            </div>
            <div>
              <Label htmlFor="user-email">E-post</Label>
              <Input
                id="user-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="namn@exempel.se"
              />
            </div>
            {!editingUser && (
              <div>
                <Label htmlFor="user-password">
                  Lösenord{" "}
                  <span className="text-muted-foreground font-normal">
                    (lämna tomt för auto-genererat)
                  </span>
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>
            )}
            <div>
              <Label htmlFor="user-phone">Telefon</Label>
              <Input
                id="user-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="070-123 45 67"
              />
            </div>
            <div>
              <Label htmlFor="user-company">Företag</Label>
              <Input
                id="user-company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Företagsnamn AB"
              />
            </div>
            <div>
              <Label htmlFor="user-address">Adress</Label>
              <Input
                id="user-address"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                placeholder="Gatuadress 1"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="user-postcode">Postnummer</Label>
                <Input
                  id="user-postcode"
                  value={formData.address_postcode}
                  onChange={(e) => setFormData({ ...formData, address_postcode: e.target.value })}
                  placeholder="123 45"
                />
              </div>
              <div>
                <Label htmlFor="user-city">Stad</Label>
                <Input
                  id="user-city"
                  value={formData.address_city}
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  placeholder="Stockholm"
                />
              </div>
              <div>
                <Label htmlFor="user-country">Land</Label>
                <Input
                  id="user-country"
                  value={formData.address_country}
                  onChange={(e) => setFormData({ ...formData, address_country: e.target.value })}
                  placeholder="SE"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Avbryt
            </Button>
            <Button
              onClick={() => saveUserMutation.mutate()}
              disabled={saveUserMutation.isPending}
            >
              {saveUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingUser ? "Spara" : "Skapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;

/* ── Affiliate inline section ── */

interface AffiliateSectionProps {
  userId: string;
  affiliate: any | null;
  editForm: { referral_code: string; commission_rate: string; status: string; payout_method: string; payout_details: string } | null;
  saving: boolean;
  onStartEdit: (aff: any | null) => void;
  onCancelEdit: () => void;
  onChange: (field: string, value: string) => void;
  onSave: () => void;
}

const AffiliateSection = ({ affiliate, editForm, saving, onStartEdit, onCancelEdit, onChange, onSave }: AffiliateSectionProps) => {
  const isEditing = !!editForm;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <LinkIcon className="h-4 w-4" />
        Affiliate
      </h4>

      {!affiliate && !isEditing && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Ingen affiliate kopplad</p>
          <Button size="sm" variant="outline" onClick={() => onStartEdit(null)}>
            <Plus className="h-4 w-4 mr-1" />
            Skapa affiliate
          </Button>
        </div>
      )}

      {affiliate && !isEditing && (
        <div className="space-y-3">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div>
              <span className="text-muted-foreground text-xs block">Kod</span>
              <span className="font-mono">{affiliate.referral_code}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Provision</span>
              <span>{affiliate.commission_rate}%</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Status</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                affiliate.status === "approved" ? "bg-primary/10 text-primary"
                : affiliate.status === "pending" ? "bg-amber-500/10 text-amber-600"
                : "bg-destructive/10 text-destructive"
              }`}>
                {affiliate.status === "approved" ? "Godkänd" : affiliate.status === "pending" ? "Väntande" : affiliate.status === "rejected" ? "Nekad" : "Pausad"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Utbetalning</span>
              <span>{affiliate.payout_method || "–"}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => onStartEdit(affiliate)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Redigera
            </Button>
          </div>
          <div className="bg-muted/50 rounded-md px-3 py-2">
            <span className="text-muted-foreground text-xs block mb-0.5">Trackerlänk</span>
            <code className="text-xs font-mono select-all break-all">
              {window.location.origin}/?ref={affiliate.referral_code}
            </code>
          </div>
        </div>
      )}

      {isEditing && editForm && (
        <div className="bg-background border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Affiliate-kod</Label>
              <Input
                value={editForm.referral_code}
                onChange={(e) => onChange("referral_code", e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                maxLength={30}
                readOnly={!!affiliate}
                className={affiliate ? "bg-muted cursor-not-allowed" : ""}
              />
              {affiliate && <p className="text-xs text-muted-foreground">Koden kan inte ändras efter skapande</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Provision %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={editForm.commission_rate}
                onChange={(e) => onChange("commission_rate", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => onChange("status", v)}>
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
            <div className="space-y-1">
              <Label className="text-xs">Utbetalningsmetod</Label>
              <Input
                value={editForm.payout_method}
                onChange={(e) => onChange("payout_method", e.target.value)}
                placeholder="T.ex. PayPal, Bank"
                maxLength={100}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Utbetalningsdetaljer</Label>
              <Input
                value={editForm.payout_details}
                onChange={(e) => onChange("payout_details", e.target.value)}
                placeholder="Kontonummer, e-post etc."
                maxLength={255}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Sparar..." : "Spara"}
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>Avbryt</Button>
          </div>
        </div>
      )}
    </div>
  );
};
