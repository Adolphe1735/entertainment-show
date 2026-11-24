import { Bookmark, BookmarkCheck, Play, Star } from 'lucide-react';
import type { CinemaItem } from '../types/cinema';
import { MediaImage } from './MediaImage';

interface MediaCardProps {
  item: CinemaItem;
  onSelect: (item: CinemaItem) => void;
  onPlayTrailer?: (item: CinemaItem) => void;
  inWatchlist: boolean;
  onToggleWatchlist: (item: CinemaItem) => void;
  rankIndex?: number;
}

export function MediaCard({
  item,
  onSelect,
  onPlayTrailer,
  inWatchlist,
  onToggleWatchlist,
  rankIndex,
}: MediaCardProps) {
  const typeLabel =
    item.type === 'tv' ? 'TV Series' : item.type === 'anime' ? 'Anime' : 'Movie';

  return (
    <article className="group relative flex flex-col rounded-lg overflow-hidden bg-card border border-border card-lift">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`View details for ${item.title}`}
        >
          <MediaImage
            src={item.posterUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </button>

        {typeof rankIndex === 'number' && (
          <div className="pointer-events-none absolute top-2 left-2 flex h-7 min-w-7 items-center justify-center rounded-md bg-black/75 px-1.5 font-mono text-xs font-semibold text-white tabular-nums backdrop-blur-sm">
            #{rankIndex}
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist(item);
          }}
          aria-label={inWatchlist ? `Remove ${item.title} from watchlist` : `Add ${item.title} to watchlist`}
          className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            inWatchlist
              ? 'bg-primary text-primary-foreground'
              : 'bg-black/60 text-white hover:bg-primary'
          }`}
        >
          {inWatchlist ? (
            <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {item.trailerUrl && onPlayTrailer && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayTrailer(item);
            }}
            className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-center gap-1.5 rounded-md bg-primary/95 py-1.5 px-3 text-xs font-semibold text-primary-foreground opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-primary whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Watch Trailer
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect(item)}
        className="flex flex-1 flex-col justify-between p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <h3 className="text-sm font-semibold text-card-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {item.year ?? 'New'}
            <span aria-hidden="true"> · </span>
            {typeLabel}
          </span>
          <span className="flex items-center gap-1 font-mono font-medium text-foreground tabular-nums shrink-0">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
            {item.rating.toFixed(1)}
          </span>
        </div>
      </button>
    </article>
  );
}
