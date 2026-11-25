import {
  BookmarkCheck,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  Film,
  Globe,
  Heart,
  Play,
  RefreshCw,
  Scale,
  Search,
  Star,
  Tv,
  Users,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type {
  CalendarResponse,
  CinemaItem,
  DiscoverResponse,
  PersonItem,
  SearchResponse,
  UserReview,
} from '../types/cinema';
import { buildWatchlistCsv, downloadTextFile } from '../utils/download';
import { MediaCard } from './MediaCard';
import { MediaImage } from './MediaImage';

interface CommonHandlers {
  onSelectMedia: (item: CinemaItem) => void;
  onPlayTrailer: (item: CinemaItem) => void;
  onDownload?: (item: CinemaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: CinemaItem) => void;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="aspect-[2/3] shimmer" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 w-3/4 rounded shimmer" />
            <div className="h-3 w-1/2 rounded shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorRetryCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

// 1. DISCOVER / MOVIES / TV / TRENDING CATALOG VIEW
interface DiscoverViewProps extends CommonHandlers {
  title: string;
  subtitle: string;
  initialType?: 'all' | 'movie' | 'tv' | 'anime';
  initialGenre?: string;
  initialSort?: 'trending' | 'rating' | 'newest' | 'title';
  lockType?: boolean;
}

const REGIONS = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'jp', label: 'Japan' },
  { code: 'kr', label: 'South Korea' },
  { code: 'fr', label: 'France' },
];

export function DiscoverView({
  title,
  subtitle,
  initialType = 'all',
  initialGenre = 'all',
  initialSort = 'trending',
  lockType = false,
  onSelectMedia,
  onPlayTrailer,
  onDownload,
  isInWatchlist,
  onToggleWatchlist,
}: DiscoverViewProps) {
  const [type, setType] = useState<'all' | 'movie' | 'tv' | 'anime'>(initialType);
  const [genre, setGenre] = useState(initialGenre);
  const [region, setRegion] = useState('us');
  const [sort, setSort] = useState<'trending' | 'rating' | 'newest' | 'title'>(initialSort);
  const [year, setYear] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    setGenre(initialGenre);
  }, [initialGenre]);

  useEffect(() => {
    setSort(initialSort);
  }, [initialSort]);

  useEffect(() => {
    setPage(1);
  }, [type, genre, region, sort, year, minRating]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      type,
      genre,
      region,
      sort,
      year,
      minRating: String(minRating),
      page: String(page),
      limit: '24',
    });

    fetch(`/api/cinema/discover?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((resData: DiscoverResponse) => {
        if (!cancelled) setData(resData);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, genre, region, sort, year, minRating, page, retryTick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {data && (
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {data.total} titles matched · Page {data.page} of {data.totalPages}
          </p>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
        {!lockType && (
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'movie', label: 'Movies' },
                { id: 'tv', label: 'TV Shows' },
                { id: 'anime', label: 'Anime' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  type === opt.id
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <select
          aria-label="Filter by genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Genres</option>
          {(data?.genres || []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {type !== 'tv' && (
          <select
            aria-label="Select cinema region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                Region: {r.label}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Filter by era"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Years</option>
          <option value="2026">2026 Releases</option>
          <option value="2025">2025 Releases</option>
          <option value="2020s">2020s</option>
          <option value="2010s">2010s</option>
          <option value="classic">Classics (&lt; 2010)</option>
        </select>

        <select
          aria-label="Filter by minimum rating"
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value={0}>Any Rating</option>
          <option value={7}>7.0+ Stars</option>
          <option value={8}>8.0+ Stars</option>
          <option value={8.5}>8.5+ Acclaimed</option>
        </select>

        <select
          aria-label="Sort results"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'trending' | 'rating' | 'newest' | 'title')}
          className="ml-auto h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="trending">Sort: Trending</option>
          <option value="rating">Sort: Top Rated</option>
          <option value="newest">Sort: Newest</option>
          <option value="title">Sort: A–Z</option>
        </select>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorRetryCard
          message="Could not load cinema catalog right now."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {data.items.map((item, idx) => (
              <MediaCard
                key={item.id}
                item={item}
                onSelect={onSelectMedia}
                onPlayTrailer={onPlayTrailer}
                onDownload={onDownload}
                inWatchlist={isInWatchlist(item.id)}
                onToggleWatchlist={onToggleWatchlist}
                rankIndex={sort === 'trending' && page === 1 && idx < 10 ? idx + 1 : undefined}
              />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                Page {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">No titles match these filters.</p>
          <button
            type="button"
            onClick={() => {
              setGenre('all');
              setYear('all');
              setMinRating(0);
              if (!lockType) setType('all');
            }}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}

// 2. PEOPLE VIEW
export function PeopleView({
  onSelectPerson,
}: {
  onSelectPerson: (p: { id: string; name: string; imageUrl?: string }) => void;
}) {
  const [page, setPage] = useState(0);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/cinema/people?page=${page}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data: { items: PersonItem[] }) => {
        if (!cancelled) setPeople(data.items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, retryTick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            People &amp; Filmmakers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse actors, creators, and television talent from live cast indexes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
          >
            Prev
          </button>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            Page {page + 1}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorRetryCard
          message="Could not load people directory right now."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() =>
                onSelectPerson({
                  id: person.id,
                  name: person.name,
                  imageUrl: person.imageUrl,
                })
              }
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left card-lift"
            >
              <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
                <MediaImage
                  src={person.imageUrl}
                  alt={person.name}
                  fallbackKind="person"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {person.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {person.country || person.knownFor || 'Actor'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 3. GENRES VIEW
const GENRE_CARDS = [
  { name: 'Action', desc: 'High-stakes cinema, stunts, and blockbusters' },
  { name: 'Sci-Fi', desc: 'Futuristic worlds, space epics, and speculative fiction' },
  { name: 'Drama', desc: 'Character-driven cinema and prestige television' },
  { name: 'Thriller', desc: 'Suspense, mystery, and psychological tension' },
  { name: 'Comedy', desc: 'Sharp satire, ensemble humor, and light-hearted hits' },
  { name: 'Horror', desc: 'Supernatural terror, slashers, and atmospheric dread' },
  { name: 'Animation', desc: 'Studio Ghibli classics and modern animated features' },
  { name: 'Documentary', desc: 'Non-fiction cinema, music stories, and investigative docs' },
  { name: 'Crime', desc: 'Heists, detective investigations, and neo-noir' },
  { name: 'Romance', desc: 'Contemporary love stories and timeless dramas' },
  { name: 'Fantasy', desc: 'Mythic quests, magic systems, and epic adventures' },
  { name: 'Classics', desc: 'Enduring masterpieces from cinema history' },
];

export function GenresView(props: CommonHandlers & { activeGenre: string; onChangeGenre: (g: string) => void }) {
  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Browse by Genre
        </h1>
        <p className="mt-1 text-sm text-muted-foreground mb-5">
          Select any cinema or television category to explore titles.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {GENRE_CARDS.map((g) => {
            const active = props.activeGenre.toLowerCase() === g.name.toLowerCase();
            return (
              <button
                key={g.name}
                type="button"
                onClick={() => props.onChangeGenre(g.name)}
                className={`rounded-lg border p-3.5 text-left transition-all ${
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/40'
                }`}
              >
                <div className="font-display text-sm font-bold">{g.name}</div>
                <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{g.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <DiscoverView
        title={`${props.activeGenre === 'all' ? 'All Genres' : props.activeGenre} Cinema & TV`}
        subtitle="Filtered live across movies, television series, and animated features."
        initialGenre={props.activeGenre}
        onSelectMedia={props.onSelectMedia}
        onPlayTrailer={props.onPlayTrailer}
        onDownload={props.onDownload}
        isInWatchlist={props.isInWatchlist}
        onToggleWatchlist={props.onToggleWatchlist}
      />
    </div>
  );
}

// 4. TRAILERS HUB
export function TrailersView({
  onSelectMedia,
  onPlayTrailer,
  onDownload,
}: {
  onSelectMedia: (item: CinemaItem) => void;
  onPlayTrailer: (item: CinemaItem) => void;
  onDownload?: (item: CinemaItem) => void;
}) {
  const [items, setItems] = useState<CinemaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch('/api/cinema/trailers')
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((d: { items: CinemaItem[] }) => {
        if (!cancelled) setItems(d.items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Official Trailers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stream instant previews and trailers directly inside CineVerse.
        </p>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorRetryCard
          message="Could not load official trailers right now."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="group overflow-hidden rounded-xl border border-border bg-card card-lift"
            >
              <button
                type="button"
                onClick={() => onPlayTrailer(item)}
                className="relative aspect-video w-full overflow-hidden bg-muted text-left"
              >
                <MediaImage
                  src={item.backdropUrl || item.posterUrl}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
                    <Play className="h-5 w-5 fill-current ml-0.5" aria-hidden="true" />
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="text-xs text-white/75">
                    {item.year ?? 'New'} · {item.genres[0] || 'Cinema'}
                  </div>
                  <h3 className="font-display text-base font-bold truncate">{item.title}</h3>
                </div>
              </button>
              <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
                <span className="truncate">{item.director || 'Feature Film'}</span>
                <div className="flex items-center gap-2.5 shrink-0">
                  {onDownload && item.trailerUrl && (
                    <button
                      type="button"
                      onClick={() => onDownload(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectMedia(item)}
                    className="font-semibold text-primary hover:underline shrink-0"
                  >
                    Details
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// 5. BOX OFFICE & CHARTS
export function BoxOfficeView({
  onSelectMedia,
  onPlayTrailer,
}: {
  onSelectMedia: (item: CinemaItem) => void;
  onPlayTrailer: (item: CinemaItem) => void;
}) {
  const [region, setRegion] = useState('us');
  const [items, setItems] = useState<CinemaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/cinema/discover?type=movie&region=${region}&sort=trending&limit=40`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((d: DiscoverResponse) => {
        if (!cancelled) setItems(d.items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [region, retryTick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Global Cinema Charts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live top-performing movies ranked across international markets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted p-1">
          {REGIONS.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => setRegion(r.code)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                region === r.code
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorRetryCard
          message="Could not load box office charts right now."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 w-16">Rank</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3 hidden md:table-cell">Director</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Genre</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-bold text-foreground tabular-nums">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSelectMedia(item)}
                        className="flex items-center gap-3 text-left group"
                      >
                        <div className="h-12 w-8 shrink-0 overflow-hidden rounded bg-muted">
                          <MediaImage
                            src={item.posterUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {item.title}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {item.year ?? 'New'} {item.price ? `· ${item.price}` : ''}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {item.director || 'Various'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {item.genres[0] || 'Cinema'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
                        {item.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {item.trailerUrl && (
                          <button
                            type="button"
                            onClick={() => onPlayTrailer(item)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                            Trailer
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectMedia(item)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 6. COMPARE MOVIES VIEW
export function CompareView({
  initialPool,
  onSelectMedia,
}: {
  initialPool: CinemaItem[];
  onSelectMedia: (item: CinemaItem) => void;
}) {
  const [leftItem, setLeftItem] = useState<CinemaItem | null>(initialPool[0] || null);
  const [rightItem, setRightItem] = useState<CinemaItem | null>(initialPool[1] || null);
  const [leftQuery, setLeftQuery] = useState('');
  const [rightQuery, setRightQuery] = useState('');
  const [leftResults, setLeftResults] = useState<CinemaItem[]>([]);
  const [rightResults, setRightResults] = useState<CinemaItem[]>([]);

  useEffect(() => {
    if (!leftItem && initialPool[0]) setLeftItem(initialPool[0]);
    if (!rightItem && initialPool[1]) setRightItem(initialPool[1]);
  }, [initialPool, leftItem, rightItem]);

  const runSearch = async (q: string, side: 'left' | 'right') => {
    if (!q.trim()) return;
    try {
      const res = await fetch(`/api/cinema/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) return;
      const data: SearchResponse = await res.json();
      const combined = [...data.movies, ...data.tv].slice(0, 6);
      if (side === 'left') setLeftResults(combined);
      else setRightResults(combined);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Compare Titles
          </h1>
          <p className="text-sm text-muted-foreground">
            Search any two films or TV series to compare ratings, release eras, genres, and creators side by side.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            side: 'left' as const,
            item: leftItem,
            query: leftQuery,
            setQuery: setLeftQuery,
            results: leftResults,
            setResults: setLeftResults,
            setItem: setLeftItem,
          },
          {
            side: 'right' as const,
            item: rightItem,
            query: rightQuery,
            setQuery: setRightQuery,
            results: rightResults,
            setResults: setRightResults,
            setItem: setRightItem,
          },
        ].map((slot) => (
          <div key={slot.side} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                runSearch(slot.query, slot.side);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={slot.query}
                  onChange={(e) => slot.setQuery(e.target.value)}
                  placeholder="Search a movie or TV show..."
                  className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Find
              </button>
            </form>

            {slot.results.length > 0 && (
              <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
                {slot.results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      slot.setItem(r);
                      slot.setResults([]);
                    }}
                    className="flex items-center gap-2 rounded-md border border-border bg-background p-1.5 text-left hover:border-primary"
                  >
                    <MediaImage
                      src={r.posterUrl}
                      alt={r.title}
                      className="h-10 w-7 rounded object-cover shrink-0"
                    />
                    <span className="text-xs font-medium text-foreground line-clamp-1">
                      {r.title}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {slot.item && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => onSelectMedia(slot.item!)}
                    className="w-28 shrink-0 aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted"
                  >
                    <MediaImage
                      src={slot.item.posterUrl}
                      alt={slot.item.title}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="space-y-2 min-w-0 flex-1">
                    <h2 className="font-display text-xl font-bold text-foreground">
                      {slot.item.title}
                    </h2>
                    <div className="flex items-center gap-2 text-sm font-mono tabular-nums">
                      <Star className="h-4 w-4 fill-accent text-accent" />
                      <span className="font-bold text-foreground">{slot.item.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">/ 10</span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-2">
                      <dt className="text-muted-foreground">Format</dt>
                      <dd className="font-medium text-foreground uppercase">{slot.item.type}</dd>
                      <dt className="text-muted-foreground">Release</dt>
                      <dd className="font-medium text-foreground tabular-nums">{slot.item.releaseDate || slot.item.year || 'N/A'}</dd>
                      <dt className="text-muted-foreground">Genres</dt>
                      <dd className="font-medium text-foreground">{slot.item.genres.slice(0, 2).join(', ')}</dd>
                      <dt className="text-muted-foreground">Creator</dt>
                      <dd className="font-medium text-foreground truncate">{slot.item.director || slot.item.network || 'N/A'}</dd>
                    </dl>
                  </div>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  {slot.item.overview}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 7. RELEASE CALENDAR VIEW
export function CalendarView({ onSelectMedia }: { onSelectMedia: (item: CinemaItem) => void }) {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch('/api/cinema/calendar')
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((d: CalendarResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-center gap-3">
        <CalendarIcon className="h-6 w-6 text-primary" aria-hidden="true" />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Release Calendar &amp; Air Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            Live television episodes airing today alongside new 2025–2026 theatrical &amp; digital movie releases.
          </p>
        </div>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorRetryCard
          message="Could not load release calendar right now."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" aria-hidden="true" />
              Airing on Television Today
            </h2>
            <div className="space-y-2.5">
              {(data?.airingToday || []).map((slot, idx) => (
                <button
                  key={`${slot.show.id}-${idx}`}
                  type="button"
                  onClick={() => onSelectMedia(slot.show)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/50 transition-colors"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    <MediaImage
                      src={slot.show.posterUrl}
                      alt={slot.show.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {slot.show.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      S{slot.season} E{slot.number} · {slot.episodeName}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-foreground tabular-nums shrink-0">
                    <div>{slot.airtime}</div>
                    <div className="text-[11px] text-muted-foreground">{slot.show.network}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" aria-hidden="true" />
              New &amp; Recent Film Releases
            </h2>
            <div className="space-y-2.5">
              {(data?.recentMovies || []).map((movie) => (
                <button
                  key={movie.id}
                  type="button"
                  onClick={() => onSelectMedia(movie)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/50 transition-colors"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    <MediaImage
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {movie.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {movie.director || 'Feature Film'} · {movie.genres[0]}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-muted-foreground tabular-nums shrink-0">
                    {movie.releaseDate || movie.year}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// 8. WATCHLIST, FAVORITES & REVIEWS VIEW
type LibrarySortBy =
  | 'dateAddedDesc'
  | 'dateAddedAsc'
  | 'yearDesc'
  | 'yearAsc'
  | 'typeMovieFirst'
  | 'typeTvFirst';

type LibraryMediaFilter = 'all' | 'movie' | 'tv';

function isTvItem(item: CinemaItem): boolean {
  return item.type === 'tv' || (item.type === 'anime' && item.source === 'tvmaze');
}

function organizeLibraryItems(
  items: CinemaItem[],
  mediaFilter: LibraryMediaFilter,
  sortBy: LibrarySortBy
): CinemaItem[] {
  const indexed = items.map((item, idx) => ({ item, idx }));

  const filtered = indexed.filter(({ item }) => {
    if (mediaFilter === 'movie') return !isTvItem(item);
    if (mediaFilter === 'tv') return isTvItem(item);
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'dateAddedDesc') {
      const ta = a.item.addedAt ? Date.parse(a.item.addedAt) : 0;
      const tb = b.item.addedAt ? Date.parse(b.item.addedAt) : 0;
      if (tb !== ta) return tb - ta;
      return a.idx - b.idx;
    }
    if (sortBy === 'dateAddedAsc') {
      const ta = a.item.addedAt ? Date.parse(a.item.addedAt) : 0;
      const tb = b.item.addedAt ? Date.parse(b.item.addedAt) : 0;
      if (ta !== tb) return ta - tb;
      return b.idx - a.idx;
    }
    if (sortBy === 'yearDesc') {
      return (b.item.year ?? 0) - (a.item.year ?? 0) || a.idx - b.idx;
    }
    if (sortBy === 'yearAsc') {
      return (a.item.year ?? 9999) - (b.item.year ?? 9999) || a.idx - b.idx;
    }
    if (sortBy === 'typeMovieFirst') {
      const aTv = isTvItem(a.item) ? 1 : 0;
      const bTv = isTvItem(b.item) ? 1 : 0;
      return aTv - bTv || a.idx - b.idx;
    }
    // typeTvFirst
    const aTv = isTvItem(a.item) ? 0 : 1;
    const bTv = isTvItem(b.item) ? 0 : 1;
    return aTv - bTv || a.idx - b.idx;
  });

  return filtered.map((entry) => entry.item);
}

export function WatchlistView({
  watchlist,
  favorites,
  reviews,
  onSelectMedia,
  onPlayTrailer,
  onDownload,
  isInWatchlist,
  onToggleWatchlist,
}: CommonHandlers & {
  watchlist: CinemaItem[];
  favorites: CinemaItem[];
  reviews: UserReview[];
}) {
  const [tab, setTab] = useState<'watchlist' | 'favorites' | 'reviews'>('watchlist');
  const [mediaFilter, setMediaFilter] = useState<LibraryMediaFilter>('all');
  const [sortBy, setSortBy] = useState<LibrarySortBy>('dateAddedDesc');

  const activeSourceList = tab === 'watchlist' ? watchlist : favorites;
  const organizedItems = organizeLibraryItems(activeSourceList, mediaFilter, sortBy);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Your Cinema Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved watchlist titles, favorited films, and your published reviews.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab('watchlist')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'watchlist' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Watchlist ({watchlist.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('favorites')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'favorites' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Heart className="h-3.5 w-3.5" aria-hidden="true" />
            Favorites ({favorites.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('reviews')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'reviews' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            Reviews ({reviews.length})
          </button>
        </div>
      </div>

      {tab !== 'reviews' && activeSourceList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filter by media type">
              {(
                [
                  { id: 'all', label: 'All Types' },
                  { id: 'movie', label: 'Movies' },
                  { id: 'tv', label: 'TV Shows' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMediaFilter(opt.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    mediaFilter === opt.id
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              Showing {organizedItems.length} of {activeSourceList.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="watchlist-sort" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Sort by
            </label>
            <select
              id="watchlist-sort"
              aria-label="Sort saved items"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LibrarySortBy)}
              className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="dateAddedDesc">Date Added (Newest first)</option>
              <option value="dateAddedAsc">Date Added (Oldest first)</option>
              <option value="yearDesc">Release Year (Newest first)</option>
              <option value="yearAsc">Release Year (Oldest first)</option>
              <option value="typeMovieFirst">Media Type (Movies first)</option>
              <option value="typeTvFirst">Media Type (TV Shows first)</option>
            </select>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  JSON.stringify(organizedItems, null, 2),
                  `cineverse-${tab}.json`,
                  'application/json;charset=utf-8'
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
              JSON
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  buildWatchlistCsv(organizedItems),
                  `cineverse-${tab}.csv`,
                  'text/csv;charset=utf-8'
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              CSV
            </button>
          </div>
        </div>
      )}

      {tab === 'watchlist' && (
        watchlist.length > 0 ? (
          organizedItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {organizedItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onSelect={onSelectMedia}
                  onPlayTrailer={onPlayTrailer}
                  onDownload={onDownload}
                  inWatchlist={isInWatchlist(item.id)}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No {mediaFilter === 'movie' ? 'movies' : 'TV shows'} in your watchlist yet.
              </p>
              <button
                type="button"
                onClick={() => setMediaFilter('all')}
                className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Show All Types
              </button>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            Your watchlist is empty. Click the bookmark icon on any movie or TV show to save it here.
          </div>
        )
      )}

      {tab === 'favorites' && (
        favorites.length > 0 ? (
          organizedItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {organizedItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onSelect={onSelectMedia}
                  onPlayTrailer={onPlayTrailer}
                  onDownload={onDownload}
                  inWatchlist={isInWatchlist(item.id)}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No {mediaFilter === 'movie' ? 'movies' : 'TV shows'} in your favorites yet.
              </p>
              <button
                type="button"
                onClick={() => setMediaFilter('all')}
                className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Show All Types
              </button>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No favorites yet. Open any title and click Favorite to highlight it here.
          </div>
        )
      )}

      {tab === 'reviews' && (
        reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((rev) => (
              <div key={rev.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-bold text-foreground">
                    {rev.mediaTitle}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-foreground tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
                    {rev.rating}/10
                  </span>
                </div>
                <p className="text-sm text-foreground/90">{rev.text}</p>
                <div className="text-xs text-muted-foreground">
                  Reviewed by {rev.author} · {new Date(rev.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            You haven&apos;t published any reviews yet. Open any movie or TV show to rate and review it.
          </div>
        )
      )}
    </div>
  );
}

// 9. SEARCH RESULTS VIEW
export function SearchResultsView({
  query,
  onSelectMedia,
  onPlayTrailer,
  onDownload,
  onSelectPerson,
  isInWatchlist,
  onToggleWatchlist,
}: CommonHandlers & {
  query: string;
  onSelectPerson: (p: { id: string; name: string; imageUrl?: string }) => void;
}) {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/cinema/search?q=${encodeURIComponent(query.trim())}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((d: SearchResponse) => {
        if (!cancelled) setResults(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, retryTick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Search results for &ldquo;{query}&rdquo;
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live results across IMDb cinema index, TVMaze television series, iTunes charts, and cast profiles.
        </p>
      </div>

      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorRetryCard
          message={`Could not complete search for "${query}".`}
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      ) : results ? (
        <div className="space-y-10">
          {results.movies.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" aria-hidden="true" />
                Movies ({results.movies.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.movies.map((m) => (
                  <MediaCard
                    key={m.id}
                    item={m}
                    onSelect={onSelectMedia}
                    onPlayTrailer={onPlayTrailer}
                    onDownload={onDownload}
                    inWatchlist={isInWatchlist(m.id)}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                ))}
              </div>
            </section>
          )}

          {results.tv.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
                <Tv className="h-5 w-5 text-primary" aria-hidden="true" />
                TV Series ({results.tv.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.tv.map((t) => (
                  <MediaCard
                    key={t.id}
                    item={t}
                    onSelect={onSelectMedia}
                    onPlayTrailer={onPlayTrailer}
                    onDownload={onDownload}
                    inWatchlist={isInWatchlist(t.id)}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                ))}
              </div>
            </section>
          )}

          {results.people.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                People ({results.people.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() =>
                      onSelectPerson({
                        id: person.id,
                        name: person.name,
                        imageUrl: person.imageUrl,
                      })
                    }
                    className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left card-lift"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
                      <MediaImage
                        src={person.imageUrl}
                        alt={person.name}
                        fallbackKind="person"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {person.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {person.knownFor || person.country || 'Cast'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.movies.length === 0 && results.tv.length === 0 && results.people.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              No movies, TV shows, or people matched &ldquo;{query}&rdquo;. Try another title or actor name.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
