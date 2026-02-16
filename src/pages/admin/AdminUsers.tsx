import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";

const PAGE_SIZE = 25;

const AdminUsers = () => {
  const queryClient = useQueryClient();
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
    phone: "",
    company: "",
    address_line1: "",
    address_city: "",
    address_postcode: "",
    address_country: "",
  });

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
      // Paginate to avoid 1000 limit
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
      if (editingUser) {
        // Update existing user
        const { data, error } = await supabase.functions.invoke("manage-user", {
          body: {
            action: "update",
            userId: editingUser.user_id,
            name: formData.name,
            email: formData.email,
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

  const emptyForm = { name: "", email: "", password: "", phone: "", company: "", address_line1: "", address_city: "", address_postcode: "", address_country: "" };

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
                              <div className="px-8 py-4">
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
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <p className="text-sm text-muted-foreground py-2">Inga köp registrerade</p>
                                )}
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
