import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Info, Play, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CinemaItem } from '../types/cinema';
import { MediaImage } from './MediaImage';

interface HeroSpotlightProps {
  items: CinemaItem[];
  onSelect: (item: CinemaItem) => void;
  onPlayTrailer: (item: CinemaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: CinemaItem) => void;
}

export function HeroSpotlight({
  items,
  onSelect,
  onPlayTrailer,
  isInWatchlist,
  onToggleWatchlist,
}: HeroSpotlightProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <section className="relative h-[68vh] min-h-[460px] w-full overflow-hidden bg-muted">
        <div className="absolute inset-0 shimmer" />
        <div className="absolute inset-0 hero-overlay" />
      </section>
    );
  }

  const active = items[index % items.length];
  const saved = isInWatchlist(active.id);

  return (
    <section className="relative h-[70vh] min-h-[480px] max-h-[720px] w-full overflow-hidden bg-background">
      {/* Blurred Ambient Cinema Backdrop + Crisp Poster Visual */}
      <div className="absolute inset-0">
        <MediaImage
          src={active.backdropUrl || active.posterUrl}
          alt={active.title}
          loading="eager"
          className="h-full w-full object-cover object-center scale-105 opacity-70 dark:opacity-55 transition-all duration-700"
        />
        <div className="absolute inset-0 hero-overlay" />
        <div className="absolute inset-0 hero-side-overlay" />
      </div>

      {/* Hero Foreground Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 items-end gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-medium text-muted-foreground">
              <span className="text-primary font-semibold">Featured Cinema</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{active.year ?? '2026'}</span>
              {active.genres.slice(0, 2).map((g) => (
                <span key={g} className="inline-flex items-center gap-2.5">
                  <span aria-hidden="true">·</span>
                  <span>{g}</span>
                </span>
              ))}
              {active.runtimeMinutes && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {Math.floor(active.runtimeMinutes / 60)}h {active.runtimeMinutes % 60}m
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-foreground tabular-nums">
                <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
                {active.rating.toFixed(1)}
              </span>
            </div>

            <h1
              className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl max-w-2xl"
              style={{ textWrap: 'balance' }}
            >
              {active.title}
            </h1>

            <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-foreground/85 line-clamp-3">
              {active.overview}
            </p>

            {active.director && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                Directed by <span className="font-medium text-foreground">{active.director}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {active.trailerUrl ? (
                <button
                  type="button"
                  onClick={() => onPlayTrailer(active)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 whitespace-nowrap shrink-0"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Watch Trailer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(active)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 whitespace-nowrap shrink-0"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                  Explore Title
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelect(active)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card/80 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-card whitespace-nowrap shrink-0"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
                More Info
              </button>

              <button
                type="button"
                onClick={() => onToggleWatchlist(active)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card/80 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-card whitespace-nowrap shrink-0"
              >
                {saved ? (
                  <>
                    <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    In Watchlist
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" aria-hidden="true" />
                    Watchlist
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Poster Preview & Slide Controls */}
          <div className="hidden lg:flex lg:col-span-4 flex-col items-end gap-4">
            <button
              type="button"
              onClick={() => onSelect(active)}
              className="group relative w-44 overflow-hidden rounded-lg border border-border bg-card shadow-2xl transition-transform duration-200 hover:-translate-y-1"
              aria-label={`Open ${active.title}`}
            >
              <div className="aspect-[2/3] w-full">
                <MediaImage
                  src={active.posterUrl}
                  alt={active.title}
                  loading="eager"
                  className="h-full w-full object-cover"
                />
              </div>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev - 1 + items.length) % items.length)}
                aria-label="Previous spotlight"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/80 text-foreground backdrop-blur-sm hover:bg-card transition-colors"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-1.5 px-1">
                {items.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndex(idx)}
                    aria-label={`Show spotlight ${idx + 1}: ${item.title}`}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev + 1) % items.length)}
                aria-label="Next spotlight"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/80 text-foreground backdrop-blur-sm hover:bg-card transition-colors"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
