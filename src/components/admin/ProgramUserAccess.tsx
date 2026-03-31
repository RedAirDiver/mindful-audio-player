import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, UserPlus, X, Loader2, Users } from "lucide-react";

interface ProgramUserAccessProps {
  programId: string;
  programTitle: string;
}

interface ProfileResult {
  user_id: string;
  name: string | null;
  email: string | null;
}

export const ProgramUserAccess = ({ programId, programTitle }: ProgramUserAccessProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<ProfileResult[]>([]);

  // Search users
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["admin-user-search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data as ProfileResult[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Get existing purchases for this program
  const { data: existingPurchases } = useQuery({
    queryKey: ["program-purchases", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("user_id")
        .eq("program_id", programId);
      if (error) throw error;
      return new Set(data.map((p) => p.user_id));
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async (users: ProfileResult[]) => {
      const inserts = users.map((u) => ({
        user_id: u.user_id,
        program_id: programId,
        amount_paid: 0,
      }));
      const { error } = await supabase.from("purchases").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-purchases", programId] });
      toast.success(`Åtkomst tilldelad till ${selectedUsers.length} användare`);
      setSelectedUsers([]);
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error("Kunde inte tilldela åtkomst: " + error.message);
    },
  });

  const toggleUser = (user: ProfileResult) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.user_id === user.user_id);
      if (exists) return prev.filter((u) => u.user_id !== user.user_id);
      return [...prev, user];
    });
  };

  const handleGrantAccess = () => {
    if (selectedUsers.length === 0) return;
    grantAccessMutation.mutate(selectedUsers);
  };

  const filteredResults = searchResults?.filter(
    (u) => !existingPurchases?.has(u.user_id)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <Label className="text-base font-semibold">Tilldela åtkomst</Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Sök och lägg till användare som ska få tillgång till detta program utan köp.
      </p>

      {/* Selected users */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((user) => (
            <Badge
              key={user.user_id}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleUser(user)}
            >
              {user.name || user.email || "Okänd"}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök användare (namn eller e-post)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Search results */}
      {searchQuery.length >= 2 && (
        <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
          {isSearching ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResults && filteredResults.length > 0 ? (
            filteredResults.map((user) => {
              const isSelected = selectedUsers.some((u) => u.user_id === user.user_id);
              return (
                <div
                  key={user.user_id}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted text-sm ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                  onClick={() => toggleUser(user)}
                >
                  <div>
                    <span className="font-medium">{user.name || "Inget namn"}</span>
                    {user.email && (
                      <span className="text-muted-foreground ml-2">{user.email}</span>
                    )}
                  </div>
                  {existingPurchases?.has(user.user_id) ? (
                    <Badge variant="outline" className="text-xs">Har redan</Badge>
                  ) : isSelected ? (
                    <Badge className="text-xs">Vald</Badge>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground p-3">Inga användare hittades</p>
          )}
        </div>
      )}

      {/* Grant access button */}
      {selectedUsers.length > 0 && (
        <Button
          type="button"
          onClick={handleGrantAccess}
          disabled={grantAccessMutation.isPending}
          className="w-full"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {grantAccessMutation.isPending
            ? "Tilldelar..."
            : `Tilldela åtkomst till ${selectedUsers.length} användare`}
        </Button>
      )}
    </div>
  );
};
