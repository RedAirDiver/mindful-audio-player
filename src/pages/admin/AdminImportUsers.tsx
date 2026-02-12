import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, FileText, Users, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { parseWpUsers, parseWpUserMeta, mergeUsersAndMeta, type MergedWpUser } from "@/lib/wpSqlParser";
import { Progress } from "@/components/ui/progress";

const BATCH_SIZE = 50;

const AdminImportUsers = () => {
  const [wpUsersFile, setWpUsersFile] = useState<File | null>(null);
  const [wpMetaFile, setWpMetaFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<MergedWpUser[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: { email: string; error: string }[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleParse = useCallback(async () => {
    if (!wpUsersFile) {
      toast.error("Ladda upp wp_users.sql först");
      return;
    }

    setIsParsing(true);
    try {
      const usersContent = await wpUsersFile.text();
      const users = parseWpUsers(usersContent);

      let metas: ReturnType<typeof parseWpUserMeta> = [];
      if (wpMetaFile) {
        const metaContent = await wpMetaFile.text();
        metas = parseWpUserMeta(metaContent);
      }

      const merged = mergeUsersAndMeta(users, metas);
      setParsedUsers(merged);
      setImportResults(null);
      toast.success(`${merged.length} användare hittades i SQL-filerna`);
    } catch (err) {
      toast.error("Kunde inte parsa SQL-filerna: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsParsing(false);
    }
  }, [wpUsersFile, wpMetaFile]);

  const handleImport = useCallback(async () => {
    if (parsedUsers.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    const totalResults = { imported: 0, updated: 0, skipped: 0, errors: [] as { email: string; error: string }[] };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Du måste vara inloggad");
        return;
      }

      // Send in batches
      const totalBatches = Math.ceil(parsedUsers.length / BATCH_SIZE);

      for (let i = 0; i < parsedUsers.length; i += BATCH_SIZE) {
        const batch = parsedUsers.slice(i, i + BATCH_SIZE).map((u) => ({
          wp_id: u.wp_id,
          email: u.email,
          display_name: u.display_name,
          first_name: u.first_name,
          last_name: u.last_name,
          password_hash: u.password_hash,
          registered: u.registered,
        }));

        const response = await supabase.functions.invoke("import-wordpress-users", {
          body: { users: batch },
        });

        if (response.error) {
          toast.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} misslyckades: ${response.error.message}`);
          break;
        }

        const batchResult = response.data?.results;
        if (batchResult) {
          totalResults.imported += batchResult.imported || 0;
          totalResults.updated += batchResult.updated || 0;
          totalResults.skipped += batchResult.skipped || 0;
          totalResults.errors.push(...(batchResult.errors || []));
        }

        setImportProgress(Math.round(((i + batch.length) / parsedUsers.length) * 100));
      }

      setImportResults(totalResults);
      toast.success(
        `Import klar! ${totalResults.imported} nya, ${totalResults.updated} uppdaterade, ${totalResults.errors.length} fel`
      );
    } catch (err) {
      toast.error("Import misslyckades: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  }, [parsedUsers]);

  const filteredUsers = parsedUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.last_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const usersWithPassword = parsedUsers.filter((u) => u.password_hash).length;
  const payingCustomers = parsedUsers.filter((u) => u.is_paying_customer).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">WordPress Import</h1>
        <p className="text-muted-foreground mt-1">
          Importera användare från WordPress/WooCommerce SQL-export
        </p>
      </div>

      {/* Step 1: Upload files */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Steg 1: Ladda upp SQL-filer</CardTitle>
          <CardDescription>
            Ladda upp wp_users.sql (obligatorisk) och wp_usermeta.sql (valfri, för namn och kundinfo)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                wp_users.sql <span className="text-destructive">*</span>
              </label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-border">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {wpUsersFile ? (
                    <>
                      <FileText className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm font-medium">{wpUsersFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(wpUsersFile.size / 1024).toFixed(0)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Klicka för att välja fil</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".sql"
                  onChange={(e) => {
                    setWpUsersFile(e.target.files?.[0] || null);
                    setParsedUsers([]);
                    setImportResults(null);
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                wp_usermeta.sql <span className="text-muted-foreground">(valfri)</span>
              </label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-border">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {wpMetaFile ? (
                    <>
                      <FileText className="h-8 w-8 text-primary mb-2" />
                      <p className="text-sm font-medium">{wpMetaFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(wpMetaFile.size / 1024).toFixed(0)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Klicka för att välja fil</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".sql"
                  onChange={(e) => {
                    setWpMetaFile(e.target.files?.[0] || null);
                    setParsedUsers([]);
                    setImportResults(null);
                  }}
                />
              </label>
            </div>
          </div>

          <Button
            onClick={handleParse}
            disabled={!wpUsersFile || isParsing}
            className="mt-4"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parserar...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Parsa SQL-filer
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Preview */}
      {parsedUsers.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{parsedUsers.length}</p>
                    <p className="text-sm text-muted-foreground">Totalt användare</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{usersWithPassword}</p>
                    <p className="text-sm text-muted-foreground">Med lösenord</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{parsedUsers.length - usersWithPassword}</p>
                    <p className="text-sm text-muted-foreground">Utan lösenord</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{payingCustomers}</p>
                    <p className="text-sm text-muted-foreground">Betalande kunder</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Steg 2: Förhandsgranska & Importera</CardTitle>
              <CardDescription>
                Granska användarna innan du importerar. Användare med befintlig e-post hoppas över automatiskt.
              </CardDescription>
              <div className="flex items-center gap-4 mt-4">
                <input
                  type="text"
                  placeholder="Sök användare..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-sm text-muted-foreground">
                  Visar {filteredUsers.length} av {parsedUsers.length}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WP ID</TableHead>
                      <TableHead>Namn</TableHead>
                      <TableHead>E-post</TableHead>
                      <TableHead>Registrerad</TableHead>
                      <TableHead>Lösenord</TableHead>
                      <TableHead>Kund</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.slice(0, 100).map((user) => (
                      <TableRow key={user.wp_id}>
                        <TableCell className="font-mono text-xs">{user.wp_id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {user.first_name || user.last_name
                                ? `${user.first_name} ${user.last_name}`.trim()
                                : user.display_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(user.registered).toLocaleDateString("sv-SE")}
                        </TableCell>
                        <TableCell>
                          {user.password_hash ? (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              Ja
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Nej
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.is_paying_customer ? (
                            <Badge variant="default" className="text-xs">Ja</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Nej</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredUsers.length > 100 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Visar de första 100 av {filteredUsers.length} användare
                </p>
              )}

              {isImporting && (
                <div className="mt-4">
                  <Progress value={importProgress} className="mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Importerar... {importProgress}%
                  </p>
                </div>
              )}

              {importResults && (
                <div className="mt-4 p-4 rounded-lg bg-muted">
                  <h4 className="font-medium mb-2">Importresultat</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-green-600 font-bold">{importResults.imported}</span> nya
                    </div>
                    <div>
                      <span className="text-blue-600 font-bold">{importResults.updated}</span> uppdaterade
                    </div>
                    <div>
                      <span className="text-yellow-600 font-bold">{importResults.skipped}</span> överhoppade
                    </div>
                    <div>
                      <span className="text-red-600 font-bold">{importResults.errors.length}</span> fel
                    </div>
                  </div>
                  {importResults.errors.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-auto">
                      {importResults.errors.slice(0, 20).map((err, i) => (
                        <p key={i} className="text-xs text-destructive">
                          {err.email}: {err.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importerar...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importera {parsedUsers.length} användare
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminImportUsers;
