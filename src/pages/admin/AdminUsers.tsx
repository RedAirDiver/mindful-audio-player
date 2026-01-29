import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, Users, Shield, ShieldOff } from "lucide-react";

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

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
      const { data, error } = await supabase
        .from("purchases")
        .select("user_id");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((p) => {
        counts[p.user_id] = (counts[p.user_id] || 0) + 1;
      });
      return counts;
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      if (isAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
      } else {
        // Add admin role
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

  const isUserAdmin = (userId: string) => {
    return userRoles?.some((r) => r.user_id === userId && r.role === "admin");
  };

  const filteredProfiles = profiles?.filter(
    (p) =>
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Användare</h1>
        <p className="text-muted-foreground mt-1">
          Hantera användare och behörigheter
        </p>
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
            <div className="text-3xl font-bold">{profiles?.length || 0}</div>
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
                placeholder="Sök användare..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredProfiles?.length || 0} användare
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProfiles && filteredProfiles.length > 0 ? (
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
                {filteredProfiles.map((profile) => {
                  const admin = isUserAdmin(profile.user_id);
                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{profile.name || "Inget namn"}</p>
                          <p className="text-sm text-muted-foreground">
                            {profile.email || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(profile.created_at).toLocaleDateString("sv-SE")}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleAdminMutation.mutate({
                              userId: profile.user_id,
                              isAdmin: admin,
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p>Inga användare hittades</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
