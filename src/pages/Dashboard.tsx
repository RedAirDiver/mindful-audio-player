import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AudioPlayer from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Headphones, User, LogOut, ChevronRight, Download, Wifi, WifiOff, ShoppingBag, Trash2, AlertCircle, ArrowLeft, Save, Receipt, Printer } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineAudio } from "@/hooks/useOfflineAudio";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AudioFile {
  id: string;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  track_order: number;
}

interface Program {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

interface Profile {
  name: string;
  email: string;
  phone: string;
  company: string;
  address_line1: string;
  address_postcode: string;
  address_city: string;
  address_country: string;
}

interface PurchasedProgram extends Program {
  tracks: AudioFile[];
}

interface PurchaseRecord {
  id: string;
  program_id: string;
  purchase_date: string;
  amount_paid: number;
  program_title: string;
  program_image: string | null;
}

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { savedTracks, savingTrack, saveTrackOffline, removeTrackOffline, getDecryptedAudioUrl, isOnline } = useOfflineAudio();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeView, setActiveView] = useState<'programs' | 'profile' | 'purchases'>('programs');
  const [purchasedPrograms, setPurchasedPrograms] = useState<PurchasedProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<PurchasedProgram | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<AudioFile | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [mobileShowPlayer, setMobileShowPlayer] = useState(false);
  const [profile, setProfile] = useState<Profile>({ name: '', email: '', phone: '', company: '', address_line1: '', address_postcode: '', address_city: '', address_country: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchPurchasedPrograms();
      fetchProfile();
    }
  }, [user, authLoading]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('name, email, phone, company, address_line1, address_postcode, address_city, address_country')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setProfile({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        company: data.company || '',
        address_line1: data.address_line1 || '',
        address_postcode: data.address_postcode || '',
        address_city: data.address_city || '',
        address_country: data.address_country || '',
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        company: profile.company.trim(),
        address_line1: profile.address_line1.trim(),
        address_postcode: profile.address_postcode.trim(),
        address_city: profile.address_city.trim(),
        address_country: profile.address_country.trim(),
      })
      .eq('user_id', user.id);
    setSavingProfile(false);
    if (error) {
      toast.error('Kunde inte spara profilen');
    } else {
      toast.success('Profilen har sparats');
    }
  };

  // Get audio URL when track changes
  useEffect(() => {
    const loadAudio = async () => {
      if (!selectedTrack) {
        setCurrentAudioUrl(null);
        return;
      }

      // Check if track is saved offline
      if (savedTracks.has(selectedTrack.id)) {
        const offlineUrl = await getDecryptedAudioUrl(selectedTrack.id);
        if (offlineUrl) {
          setCurrentAudioUrl(offlineUrl);
          return;
        }
      }

      // If online, get streaming URL
      if (isOnline) {
        try {
          const { data, error } = await supabase.storage
            .from("audio-files")
            .createSignedUrl(selectedTrack.file_path, 3600);
          
          if (!error && data?.signedUrl) {
            setCurrentAudioUrl(data.signedUrl);
            return;
          }
        } catch (err) {
          console.error("Error getting audio URL:", err);
        }
      }

      setCurrentAudioUrl(null);
    };

    loadAudio();

    // Cleanup blob URLs
    return () => {
      if (currentAudioUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(currentAudioUrl);
      }
    };
  }, [selectedTrack, savedTracks, isOnline, getDecryptedAudioUrl]);

  const fetchPurchasedPrograms = async () => {
    try {
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select(`
          id,
          program_id,
          purchase_date,
          amount_paid,
          programs (
            id,
            title,
            description,
            image_url
          )
        `)
        .order('purchase_date', { ascending: false });

      if (purchasesError) throw purchasesError;

      if (!purchases || purchases.length === 0) {
        setPurchasedPrograms([]);
        setPurchaseRecords([]);
        setLoading(false);
        return;
      }

      // Build purchase records for history view
      const records: PurchaseRecord[] = purchases.map((p: any) => ({
        id: p.id,
        program_id: p.program_id,
        purchase_date: p.purchase_date,
        amount_paid: p.amount_paid,
        program_title: p.programs?.title || 'Okänt program',
        program_image: p.programs?.image_url || null,
      }));
      setPurchaseRecords(records);

      const programIds = purchases.map(p => p.program_id);
      // Fetch audio files via junction table
      const { data: audioLinks, error: audioError } = await supabase
        .from('program_audio_files')
        .select('program_id, track_order, audio_files(*)')
        .in('program_id', programIds)
        .order('track_order', { ascending: true }) as any;

      if (audioError) throw audioError;

      const programsWithTracks: PurchasedProgram[] = purchases.map(purchase => {
        const program = purchase.programs as unknown as Program;
        const tracks = (audioLinks || [])
          .filter((l: any) => l.program_id === program.id)
          .map((l: any) => ({
            ...l.audio_files,
            track_order: l.track_order,
          }));
        return {
          ...program,
          tracks,
        };
      });

      setPurchasedPrograms(programsWithTracks);
      if (programsWithTracks.length > 0) {
        setSelectedProgram(programsWithTracks[0]);
        if (programsWithTracks[0].tracks.length > 0) {
          setSelectedTrack(programsWithTracks[0].tracks[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveOffline = async (track: AudioFile) => {
    await saveTrackOffline(track.id, track.file_path, {
      title: track.title,
      duration: track.duration_seconds || 180,
    });
  };

  const handleRemoveOffline = async (trackId: string) => {
    await removeTrackOffline(trackId);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const openReceiptWindow = (record: PurchaseRecord) => {
    const date = new Date(record.purchase_date);
    const formattedDate = date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
    const paid = record.amount_paid;
    const vatRate = 25;
    const vatAmount = Math.round((paid * vatRate / (100 + vatRate)) * 100) / 100;
    const exclVat = Math.round((paid - vatAmount) * 100) / 100;

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Kvitto – ${record.program_title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; background: #fff; color: #1f3550; padding: 40px; max-width: 700px; margin: 0 auto; }
    .header { background: #2b5a8c; color: #fff; padding: 28px 40px; text-align: center; border-radius: 12px 12px 0 0; }
    .header img { max-width: 200px; margin-bottom: 8px; }
    .header p { color: #c0d4e8; font-size: 14px; }
    .body { padding: 40px; border: 1px solid #e2e8f0; border-top: none; }
    .info-table { width: 100%; margin-bottom: 24px; }
    .info-table td { padding: 4px 0; font-size: 14px; }
    .info-table .label { color: #718096; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .info-table .value { text-align: right; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-header td { background: #f7fafc; padding: 12px 16px; font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; }
    .items-row td { padding: 16px; font-size: 14px; }
    .totals td { padding: 6px 16px; font-size: 13px; color: #718096; }
    .totals .total-row td { font-size: 16px; font-weight: 700; color: #1f3550; padding: 12px 16px; border-top: 2px solid #2b5a8c; }
    .footer { background: #f7fafc; padding: 24px 40px; text-align: center; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
    .footer p { font-size: 12px; color: #718096; margin: 2px 0; }
    .footer .company { font-weight: 600; }
    .print-btn { display: block; margin: 20px auto; padding: 12px 32px; background: #2b5a8c; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-btn:hover { background: #1e4a73; }
    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Skriv ut kvitto</button>
  <div class="header">
    <img src="https://jjllqcgywodfnaotnkxe.supabase.co/storage/v1/object/public/product-images/logo%2Flogo.png" alt="Unestål Education" />
    <p>Kvitto / Faktura</p>
  </div>
  <div class="body">
    <table class="info-table">
      <tr><td class="label">Datum</td><td class="value">${formattedDate}</td></tr>
      ${profile.company ? `<tr><td class="label">Företag</td><td class="value">${profile.company}</td></tr>` : ''}
      <tr><td class="label">Kund</td><td class="value">${profile.name || 'Kund'}</td></tr>
      ${profile.address_line1 ? `<tr><td class="label">Adress</td><td class="value">${profile.address_line1}${profile.address_postcode ? `, ${profile.address_postcode}` : ''} ${profile.address_city || ''}</td></tr>` : ''}
    </table>
    <hr />
    <table class="items-table">
      <tr class="items-header"><td>Produkt</td><td style="text-align:right">Belopp</td></tr>
      <tr class="items-row"><td>${record.program_title}</td><td style="text-align:right">${paid === 0 ? 'Gratis' : `${paid.toFixed(2)} kr`}</td></tr>
    </table>
    ${paid > 0 ? `
    <hr />
    <table class="items-table totals">
      <tr><td>Exkl. moms</td><td style="text-align:right">${exclVat.toFixed(2)} kr</td></tr>
      <tr><td>Moms (${vatRate}%)</td><td style="text-align:right">${vatAmount.toFixed(2)} kr</td></tr>
      <tr class="total-row"><td>Totalt</td><td style="text-align:right">${paid.toFixed(2)} kr</td></tr>
    </table>` : ''}
  </div>
  <div class="footer">
    <p class="company">Unestål Education</p>
    <p>Org.nr: 556767-3347</p>
    <p>Hagalundsvägen 4, SE-702 30 Örebro</p>
    <p><a href="https://xn--mentaltrning-ncb.nu" style="color:#2b5a8c;text-decoration:none;">mentalträning.nu</a></p>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Laddar dina program...</p>
        </div>
      </div>
    );
  }

  // No purchases view
  if (purchasedPrograms.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-28 md:pt-36 pb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-md mx-auto text-center py-16">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-10 h-10 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-foreground mb-3">
                Inga mentala träningsprogram ännu
              </h1>
              <p className="text-muted-foreground mb-8">
                Du har inte köpt några mentala träningsprogram ännu. Utforska vårt utbud och börja din resa mot inre lugn.
              </p>
              <Button asChild size="lg">
                <Link to="/#programs">Utforska mentala träningsprogram</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Du är offline</p>
                <p className="text-sm text-muted-foreground">
                  Du kan bara lyssna på spår som du har sparat för offline-lyssning.
                </p>
              </div>
            </div>
          )}

          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-semibold text-foreground">
                {activeView === 'profile' ? 'Min profil' : activeView === 'purchases' ? 'Köphistorik' : 'Mina mentala träningsprogram'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {activeView === 'profile' ? 'Hantera din kontoinformation.' : activeView === 'purchases' ? 'Här ser du alla dina genomförda köp.' : 'Välkommen tillbaka! Här är dina köpta mentala träningsprogram.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/#programs">
                  Utforska fler mentala träningsprogram
                </Link>
              </Button>
              <Button
                variant={activeView === 'purchases' ? 'default' : 'ghost'}
                size="sm"
                className={activeView === 'purchases' ? '' : 'text-muted-foreground'}
                onClick={() => setActiveView(activeView === 'purchases' ? 'programs' : 'purchases')}
              >
                {activeView === 'purchases' ? (
                  <><ArrowLeft className="w-4 h-4 mr-2" />Tillbaka</>
                ) : (
                  <><Receipt className="w-4 h-4 mr-2" />Köphistorik</>
                )}
              </Button>
              <Button 
                variant={activeView === 'profile' ? 'default' : 'ghost'} 
                size="sm" 
                className={activeView === 'profile' ? '' : 'text-muted-foreground'}
                onClick={() => setActiveView(activeView === 'profile' ? 'programs' : 'profile')}
              >
                {activeView === 'profile' ? (
                  <><ArrowLeft className="w-4 h-4 mr-2" />Tillbaka</>
                ) : (
                  <><User className="w-4 h-4 mr-2" />Profil</>
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logga ut
              </Button>
            </div>
          </div>

          {/* Profile View */}
          {activeView === 'profile' && (
            <div className="max-w-2xl">
              <div className="bg-card rounded-2xl shadow-elegant p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Namn</Label>
                    <Input id="profile-name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Ditt namn" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email">E-post</Label>
                    <Input id="profile-email" value={profile.email} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">E-postadressen kan inte ändras här.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">Telefon</Label>
                    <Input id="profile-phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="Telefonnummer" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-company">Företag</Label>
                    <Input id="profile-company" value={profile.company} onChange={e => setProfile(p => ({ ...p, company: e.target.value }))} placeholder="Företagsnamn" />
                  </div>
                </div>

                <div className="border-t border-border pt-6 space-y-5">
                  <h3 className="font-semibold text-foreground">Adress</h3>
                  <div className="space-y-2">
                    <Label htmlFor="profile-address">Gatuadress</Label>
                    <Input id="profile-address" value={profile.address_line1} onChange={e => setProfile(p => ({ ...p, address_line1: e.target.value }))} placeholder="Gatuadress" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="profile-postcode">Postnummer</Label>
                      <Input id="profile-postcode" value={profile.address_postcode} onChange={e => setProfile(p => ({ ...p, address_postcode: e.target.value }))} placeholder="123 45" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-city">Stad</Label>
                      <Input id="profile-city" value={profile.address_city} onChange={e => setProfile(p => ({ ...p, address_city: e.target.value }))} placeholder="Stad" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-country">Land</Label>
                      <Input id="profile-country" value={profile.address_country} onChange={e => setProfile(p => ({ ...p, address_country: e.target.value }))} placeholder="Sverige" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} disabled={savingProfile}>
                    <Save className="w-4 h-4 mr-2" />
                    {savingProfile ? 'Sparar...' : 'Spara ändringar'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Purchases History View */}
          {activeView === 'purchases' && (
            <div className="max-w-3xl">
              <div className="bg-card rounded-2xl shadow-elegant overflow-hidden">
                {purchaseRecords.length === 0 ? (
                  <div className="p-8 text-center">
                    <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Inga köp registrerade ännu.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
                      <div className="col-span-4">Program</div>
                      <div className="col-span-2">Datum</div>
                      <div className="col-span-2 text-right">Belopp</div>
                      <div className="col-span-2 text-right">Status</div>
                      <div className="col-span-2 text-right">Kvitto</div>
                    </div>
                    {purchaseRecords.map((record) => (
                      <div key={record.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors">
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                          {record.program_image ? (
                            <img src={record.program_image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Headphones className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <span className="font-medium text-foreground text-sm truncate">{record.program_title}</span>
                        </div>
                        <div className="col-span-2 text-sm text-muted-foreground">
                          {new Date(record.purchase_date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="col-span-2 text-sm font-medium text-foreground text-right">
                          {record.amount_paid === 0 ? 'Gratis' : `${record.amount_paid} kr`}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            Betald
                          </span>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReceiptWindow(record)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            Visa
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Visar {purchaseRecords.length} köp totalt
              </p>
            </div>
          )}

          {/* Programs View */}
          {activeView === 'programs' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Programs List - hidden on mobile when viewing player */}
              {(!isMobile || !mobileShowPlayer) && (
                <div className="lg:col-span-1 space-y-4">
                  <h2 className="font-semibold text-foreground mb-4">Dina mentala träningsprogram</h2>
                  {purchasedPrograms.map((program) => (
                    <button
                      key={program.id}
                      onClick={() => {
                        setSelectedProgram(program);
                        if (program.tracks.length > 0) {
                          setSelectedTrack(program.tracks[0]);
                        }
                        if (isMobile) setMobileShowPlayer(true);
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                        selectedProgram?.id === program.id 
                          ? 'bg-primary/10 ring-2 ring-primary' 
                          : 'bg-card hover:bg-muted'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        {program.image_url ? (
                          <img src={program.image_url} alt={program.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Headphones className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{program.title}</h3>
                        <p className="text-sm text-muted-foreground">{program.tracks.length} spår</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Player & Tracks - on mobile, shown as full view with back button */}
              {(!isMobile || mobileShowPlayer) && (
                <div className="lg:col-span-2 space-y-6">
                  {/* Mobile back button */}
                  {isMobile && mobileShowPlayer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileShowPlayer(false)}
                      className="mb-2"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Tillbaka till produkter
                    </Button>
                  )}

                  {selectedProgram && selectedTrack && (
                    <>
                      <AudioPlayer 
                        title={selectedTrack.title}
                        coverImage={selectedProgram.image_url || undefined}
                        duration={selectedTrack.duration_seconds || 180}
                        audioUrl={currentAudioUrl || undefined}
                      />

                      <div className="bg-card rounded-2xl shadow-elegant p-4 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-display text-lg font-semibold text-foreground">
                            {selectedProgram.title}
                          </h3>
                          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                            <Download className="w-4 h-4" />
                            <span>Spara för offline</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          {selectedProgram.tracks.map((track, index) => {
                            const isSaved = savedTracks.has(track.id);
                            const isSaving = savingTrack === track.id;
                            const canPlay = isOnline || isSaved;

                            return (
                              <div
                                key={track.id}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                                  canPlay ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                                } ${
                                  selectedTrack.id === track.id 
                                    ? 'bg-primary/10' 
                                    : canPlay ? 'hover:bg-muted' : ''
                                }`}
                                onClick={() => canPlay && setSelectedTrack(track)}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                                  selectedTrack.id === track.id 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {selectedTrack.id === track.id ? (
                                    <Headphones className="w-4 h-4" />
                                  ) : (
                                    index + 1
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium truncate text-sm ${
                                    selectedTrack.id === track.id ? 'text-primary' : 'text-foreground'
                                  }`}>
                                    {track.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDuration(track.duration_seconds)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {isSaved ? (
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center gap-1 text-xs text-primary">
                                        <WifiOff className="w-3.5 h-3.5" />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-muted-foreground hover:text-destructive text-xs gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveOffline(track.id);
                                        }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Ta bort offline</span>
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveOffline(track);
                                      }}
                                      disabled={isSaving || !isOnline}
                                    >
                                      {isSaving ? (
                                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <Download className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="bg-muted/50 rounded-xl p-4 flex items-start gap-3">
                    <Wifi className="w-5 h-5 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Om offline-läge</p>
                      <p className="text-muted-foreground">
                        Sparade spår krypteras och lagras lokalt på din enhet. Du kan lyssna på dem utan internet, 
                        men filerna kan inte laddas ner eller kopieras till andra enheter.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
