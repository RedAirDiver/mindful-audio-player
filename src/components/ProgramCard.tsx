import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useSearchParams } from "react-router-dom";
import { Headphones, Clock, Gift } from "lucide-react";

/** Strip HTML tags and decode common entities for plain-text display */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const countryFlags: Record<string, { flag: string; label: string }> = {
  SE: { flag: "🇸🇪", label: "Svenska" },
  NO: { flag: "🇳🇴", label: "Norsk" },
  DK: { flag: "🇩🇰", label: "Dansk" },
  FI: { flag: "🇫🇮", label: "Finska" },
  EN: { flag: "🇬🇧", label: "English" },
  US: { flag: "🇺🇸", label: "English" },
  DE: { flag: "🇩🇪", label: "Deutsch" },
  FR: { flag: "🇫🇷", label: "Français" },
  ES: { flag: "🇪🇸", label: "Español" },
  IT: { flag: "🇮🇹", label: "Italiano" },
  PT: { flag: "🇵🇹", label: "Português" },
  NL: { flag: "🇳🇱", label: "Nederlands" },
  PL: { flag: "🇵🇱", label: "Polski" },
  RU: { flag: "🇷🇺", label: "Русский" },
  JP: { flag: "🇯🇵", label: "日本語" },
  CN: { flag: "🇨🇳", label: "中文" },
  KR: { flag: "🇰🇷", label: "한국어" },
  AR: { flag: "🇸🇦", label: "العربية" },
};

interface ProgramCardProps {
  slug: string;
  title: string;
  description: string;
  duration: string;
  trackCount: number;
  price: number;
  image: string;
  country?: string | null;
  featured?: boolean;
  categories?: string[];
}

const ProgramCard = ({
  slug,
  title,
  description,
  duration,
  trackCount,
  price,
  image,
  country,
  featured = false,
  categories = [],
}: ProgramCardProps) => {
  const [searchParams] = useSearchParams();
  const layoutParam = searchParams.get("layout");
  const programLink = layoutParam ? `/program/${slug}?layout=${layoutParam}` : `/program/${slug}`;
  const isFree = price === 0;
  const displayCategory = categories.find(c => c !== 'Gratisprogram') || categories[0];
  const showFlag = country && country !== 'SE' && countryFlags[country];

  return (
    <article 
      className={`group relative bg-card rounded-2xl overflow-hidden shadow-elegant hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col ${
        featured ? 'ring-2 ring-primary/20' : ''
      } ${isFree ? 'ring-2 ring-accent/30' : ''}`}
    >
      {/* Featured or Free Badge */}
      {(featured || isFree) && (
        <div className={`absolute top-4 left-4 z-10 px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 ${
          isFree ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
        }`}>
          {isFree ? (
            <>
              <Gift className="w-3 h-3" />
              Gratis
            </>
          ) : 'Populär'}
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-muted relative">
        <img 
          src={image} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {showFlag && (
          <div className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-sm font-medium shadow-sm flex items-center gap-1.5 border border-border/50">
            <span className="text-lg leading-none">{countryFlags[country!].flag}</span>
            <span className="text-xs text-foreground">{countryFlags[country!].label}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-4 flex-1 flex flex-col">
        {/* Category Badge */}
        {displayCategory && (
          <Badge variant="secondary" className="text-xs">
            {displayCategory}
          </Badge>
        )}

        {/* Title & Description */}
        <div>
          <h3 className="font-display text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {stripHtml(description)}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Headphones className="w-4 h-4" />
            <span>{trackCount} spår</span>
          </div>
          {duration && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{duration}</span>
            </div>
          )}
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-2 mt-auto">
          <div>
            <div className="text-2xl font-semibold text-foreground">
              {isFree ? (
                <span className="text-accent">Gratis</span>
              ) : (
                <>
                  {price} <span className="text-base font-normal text-muted-foreground">kr</span>
                </>
              )}
            </div>
            {!isFree && (
              <p className="text-xs text-muted-foreground">Inkl. 6% moms</p>
            )}
          </div>
          <Button size="sm" asChild>
            <Link to={programLink}>Läs mer</Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

export default ProgramCard;
