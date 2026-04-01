import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, UserPlus, Loader2, Users, FolderPlus, Check } from "lucide-react";

interface ProfileResult {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface CategoryResult {
  id: string;
  name: string;
  slug: string;
}

interface ProgramResult {
  id: string;
  title: string;
  categories: string[] | null;
}

const AdminCategoryAccess = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<ProfileResult | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Fetch all categories
  const { data: categories } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("sort_order");
      if (error) throw error;
      return data as CategoryResult[];
    },
  });

  // Fetch all programs
  const { data: allPrograms } = useQuery({
    queryKey: ["admin-all-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, title, categories")
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data as ProgramResult[];
    },
  });

  // Search users
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["admin-user-search-cat", searchQuery],
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

  // Get existing purchases for selected user
  const { data: existingPurchases } = useQuery({
    queryKey: ["user-existing-purchases", selectedUser?.user_id],
    queryFn: async () => {
      if (!selectedUser) return new Set<string>();
      const { data, error } = await supabase
        .from("purchases")
        .select("program_id")
        .eq("user_id", selectedUser.user_id);
      if (error) throw error;
      return new Set(data.map((p) => p.program_id));
    },
    enabled: !!selectedUser,
  });

  // Programs matching selected categories (programs store category NAMES, not slugs)
  const selectedCategoryNames = categories
    ?.filter((c) => selectedCategories.includes(c.id))
    .map((c) => c.name) ?? [];

  const matchingPrograms = allPrograms?.filter((p) => {
    if (!p.categories || selectedCategoryNames.length === 0) return false;
    return selectedCategoryNames.some((catName) => p.categories?.includes(catName));
  }) ?? [];

  // Programs that user doesn't already have
  const newPrograms = matchingPrograms.filter(
    (p) => !existingPurchases?.has(p.id)
  );

  const grantAccessMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser || newPrograms.length === 0) return;
      const inserts = newPrograms.map((p) => ({
        user_id: selectedUser.user_id,
        program_id: p.id,
        amount_paid: 0,
      }));
      const { error } = await supabase.from("purchases").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-existing-purchases", selectedUser?.user_id] });
      toast.success(
        `${newPrograms.length} program tilldelade till ${selectedUser?.name || selectedUser?.email}`
      );
      setSelectedCategories([]);
    },
    onError: (error) => {
      toast.error("Kunde inte tilldela åtkomst: " + error.message);
    },
  });

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const selectUser = (user: ProfileResult) => {
    setSelectedUser(user);
    setSearchQuery("");
    setSelectedCategories([]);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <FolderPlus className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kategoritilldelning</h1>
          <p className="text-sm text-muted-foreground">
            Tilldela alla program inom en kategori till en användare
          </p>
        </div>
      </div>

      {/* Step 1: Select user */}
      <div className="bg-card border rounded-lg p-5 mb-4">
        <Label className="text-base font-semibold flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          1. Välj användare
        </Label>

        {selectedUser ? (
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              {selectedUser.name || "Inget namn"} — {selectedUser.email || "Ingen e-post"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setSelectedCategories([]); }}>
              Ändra
            </Button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök användare (namn eller e-post)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchQuery.length >= 2 && (
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {isSearching ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                      onClick={() => selectUser(user)}
                    >
                      <div>
                        <span className="font-medium">{user.name || "Inget namn"}</span>
                        {user.email && (
                          <span className="text-muted-foreground ml-2">{user.email}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground p-3">Inga användare hittades</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Step 2: Select categories */}
      {selectedUser && (
        <div className="bg-card border rounded-lg p-5 mb-4">
          <Label className="text-base font-semibold flex items-center gap-2 mb-3">
            <FolderPlus className="h-4 w-4 text-primary" />
            2. Välj kategorier
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {categories?.map((cat) => (
              <label
                key={cat.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selectedCategories.includes(cat.id)}
                  onCheckedChange={() => toggleCategory(cat.id)}
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Preview & confirm */}
      {selectedUser && selectedCategories.length > 0 && (
        <div className="bg-card border rounded-lg p-5 mb-4">
          <Label className="text-base font-semibold flex items-center gap-2 mb-3">
            <Check className="h-4 w-4 text-primary" />
            3. Program som tilldelas
          </Label>

          {matchingPrograms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga program hittades i valda kategorier.</p>
          ) : (
            <>
              <div className="space-y-1 mb-4 max-h-60 overflow-y-auto">
                {matchingPrograms.map((p) => {
                  const alreadyOwned = existingPurchases?.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between text-sm px-3 py-1.5 rounded ${
                        alreadyOwned ? "opacity-50" : ""
                      }`}
                    >
                      <span>{p.title}</span>
                      {alreadyOwned && (
                        <Badge variant="outline" className="text-xs">Har redan</Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-sm text-muted-foreground mb-3">
                {newPrograms.length} nya program att tilldela
                {matchingPrograms.length - newPrograms.length > 0 && (
                  <span> ({matchingPrograms.length - newPrograms.length} har redan åtkomst)</span>
                )}
              </div>

              <Button
                onClick={() => grantAccessMutation.mutate()}
                disabled={grantAccessMutation.isPending || newPrograms.length === 0}
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {grantAccessMutation.isPending
                  ? "Tilldelar..."
                  : `Tilldela ${newPrograms.length} program`}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCategoryAccess;
