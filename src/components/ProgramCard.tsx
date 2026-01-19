import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Headphones, Clock, Star } from "lucide-react";

interface ProgramCardProps {
  id: string;
  title: string;
  description: string;
  duration: string;
  trackCount: number;
  price: number;
  image: string;
  rating?: number;
  featured?: boolean;
}

const ProgramCard = ({
  id,
  title,
  description,
  duration,
  trackCount,
  price,
  image,
  rating = 5,
  featured = false,
}: ProgramCardProps) => {
  return (
    <article 
      className={`group relative bg-card rounded-2xl overflow-hidden shadow-elegant hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
        featured ? 'ring-2 ring-primary/20' : ''
      }`}
    >
      {/* Featured Badge */}
      {featured && (
        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
          Populär
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img 
          src={image} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Rating */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star 
              key={i} 
              className={`w-4 h-4 ${i < rating ? 'text-accent fill-accent' : 'text-muted'}`} 
            />
          ))}
        </div>

        {/* Title & Description */}
        <div>
          <h3 className="font-display text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Headphones className="w-4 h-4" />
            <span>{trackCount} spår</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{duration}</span>
          </div>
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-2xl font-semibold text-foreground">
            {price} <span className="text-base font-normal text-muted-foreground">kr</span>
          </div>
          <Button size="sm" asChild>
            <Link to={`/program/${id}`}>Läs mer</Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

export default ProgramCard;
