import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AudioPlayer from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { Headphones, User, LogOut, ChevronRight, Download, Wifi, WifiOff } from "lucide-react";

// Mock purchased programs
const purchasedPrograms = [
  {
    id: "1",
    title: "Djup Avslappning",
    description: "Guidade meditationer för att släppa stress och hitta inre lugn.",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop",
    tracks: [
      { id: "t1", title: "Introduktion till avslappning", duration: "5:30", savedOffline: true },
      { id: "t2", title: "Andningsövning", duration: "8:45", savedOffline: true },
      { id: "t3", title: "Kroppsskanning", duration: "12:00", savedOffline: false },
      { id: "t4", title: "Visualisering - Stilla sjö", duration: "15:20", savedOffline: false },
      { id: "t5", title: "Avslutande meditation", duration: "10:15", savedOffline: false },
    ],
  },
  {
    id: "2",
    title: "Fokus & Koncentration",
    description: "Öka din mentala skärpa och förbättra din koncentrationsförmåga.",
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&auto=format&fit=crop",
    tracks: [
      { id: "t6", title: "Mental förberedelse", duration: "4:00", savedOffline: false },
      { id: "t7", title: "Fokusträning", duration: "10:30", savedOffline: false },
      { id: "t8", title: "Distraktionshantering", duration: "8:15", savedOffline: false },
    ],
  },
];

const Dashboard = () => {
  const [selectedProgram, setSelectedProgram] = useState(purchasedPrograms[0]);
  const [selectedTrack, setSelectedTrack] = useState(purchasedPrograms[0].tracks[0]);
  const [savingOffline, setSavingOffline] = useState<string | null>(null);

  const handleSaveOffline = (trackId: string) => {
    setSavingOffline(trackId);
    // Simulate saving
    setTimeout(() => {
      setSavingOffline(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-semibold text-foreground">Mina program</h1>
              <p className="text-muted-foreground mt-1">Välkommen tillbaka! Här är dina köpta program.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/programs">
                  Utforska fler program
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <User className="w-4 h-4 mr-2" />
                Profil
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut className="w-4 h-4 mr-2" />
                Logga ut
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Programs List */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="font-semibold text-foreground mb-4">Dina program</h2>
              {purchasedPrograms.map((program) => (
                <button
                  key={program.id}
                  onClick={() => {
                    setSelectedProgram(program);
                    setSelectedTrack(program.tracks[0]);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                    selectedProgram.id === program.id 
                      ? 'bg-primary/10 ring-2 ring-primary' 
                      : 'bg-card hover:bg-muted'
                  }`}
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={program.image} alt={program.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{program.title}</h3>
                    <p className="text-sm text-muted-foreground">{program.tracks.length} spår</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Player & Tracks */}
            <div className="lg:col-span-2 space-y-6">
              {/* Current Player */}
              <AudioPlayer 
                title={selectedTrack.title}
                coverImage={selectedProgram.image}
              />

              {/* Track List */}
              <div className="bg-card rounded-2xl shadow-elegant p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {selectedProgram.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="w-4 h-4" />
                    <span>Spara för offline</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {selectedProgram.tracks.map((track, index) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-all cursor-pointer ${
                        selectedTrack.id === track.id 
                          ? 'bg-primary/10' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedTrack(track)}
                    >
                      {/* Track Number / Playing Indicator */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
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

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${
                          selectedTrack.id === track.id ? 'text-primary' : 'text-foreground'
                        }`}>
                          {track.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{track.duration}</p>
                      </div>

                      {/* Offline Status */}
                      <div className="flex items-center gap-2">
                        {track.savedOffline ? (
                          <div className="flex items-center gap-1 text-sm text-primary">
                            <WifiOff className="w-4 h-4" />
                            <span className="hidden sm:inline">Sparad</span>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveOffline(track.id);
                            }}
                            disabled={savingOffline === track.id}
                            className="text-muted-foreground"
                          >
                            {savingOffline === track.id ? (
                              <span className="flex items-center gap-1">
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <span className="hidden sm:inline">Sparar...</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Spara</span>
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Offline Info */}
              <div className="bg-muted/50 rounded-xl p-4 flex items-start gap-3">
                <Wifi className="w-5 h-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Om offline-läge</p>
                  <p className="text-muted-foreground">
                    Sparade spår kan lyssnas utan internetuppkoppling. Klicka på "Spara" för att ladda ner spår till din enhet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
