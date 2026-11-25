import { Mic, RefreshCw, Search, Tv, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AgasobanuyeResponse, CinemaItem, Umusobanuzi } from '../types/cinema';
import { MediaCard } from './MediaCard';

interface AgasobanuyeViewProps {
  initialTranslatorId?: string;
  onSelectMedia: (item: CinemaItem) => void;
  onPlayTrailer: (item: CinemaItem) => void;
  onDownload?: (item: CinemaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: CinemaItem) => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function AgasobanuyeView({
  initialTranslatorId = 'all',
  onSelectMedia,
  onPlayTrailer,
  onDownload,
  isInWatchlist,
  onToggleWatchlist,
}: AgasobanuyeViewProps) {
  const [subTab, setSubTab] = useState<'films' | 'abasobanuzi'>('films');
  const [translator, setTranslator] = useState<string>(initialTranslatorId);
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [eraFilter, setEraFilter] = useState<string>('all');
  const [data, setData] = useState<AgasobanuyeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    setTranslator(initialTranslatorId);
    if (initialTranslatorId !== 'all') {
      setSubTab('films');
    }
  }, [initialTranslatorId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      translator,
      category,
      q: query.trim(),
    });

    fetch(`/api/cinema/agasobanuye?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load Agasobanuye');
        return res.json();
      })
      .then((resData: AgasobanuyeResponse) => {
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
  }, [translator, category, query, retryTick]);

  const abasobanuziList = data?.abasobanuzi || [];
  const activeTranslator: Umusobanuzi | undefined = abasobanuziList.find(
    (u) => u.id === translator
  );

  const filteredAbasobanuzi = abasobanuziList.filter((u) => {
    const matchesEra = eraFilter === 'all' || u.era === eraFilter;
    const qLower = query.trim().toLowerCase();
    const matchesQuery =
      !qLower ||
      u.name.toLowerCase().includes(qLower) ||
      u.aka.toLowerCase().includes(qLower) ||
      u.studio.toLowerCase().includes(qLower) ||
      u.city.toLowerCase().includes(qLower) ||
      u.bioKinyarwanda.toLowerCase().includes(qLower);
    return matchesEra && matchesQuery;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Agasobanuye mu Kinyarwanda
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Reba filimi n’ama-saison bisobanuye mu Kinyarwanda hamwe n’urutonde rw’abasobanuzi bose bakomeye bo mu Rwanda.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('films')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'films'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tv className="h-3.5 w-3.5" aria-hidden="true" />
            Filimi Zisobanuye
          </button>
          <button
            type="button"
            onClick={() => setSubTab('abasobanuzi')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'abasobanuzi'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            Abasobanuzi Bose ({abasobanuziList.length || 20})
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="relative flex-1 min-w-[210px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              subTab === 'films'
                ? 'Shakisha filimi cyangwa umusobanuzi...'
                : 'Shakisha umusobanuzi, studio cyangwa umujyi...'
            }
            aria-label="Shakisha muri Agasobanuye"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {subTab === 'films' ? (
          <>
            <select
              aria-label="Hitamo Umusobanuzi"
              value={translator}
              onChange={(e) => setTranslator(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Abasobanuzi Bose ({abasobanuziList.length || 20})</option>
              {abasobanuziList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.aka})
                </option>
              ))}
            </select>

            <select
              aria-label="Hitamo Ubwoko bwa Filimi"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Ubwoko Bwose</option>
              {(data?.categories || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { id: 'all', label: 'Bose' },
                { id: 'Pioneer', label: 'Abatangije (Pioneers)' },
                { id: 'Mainstream', label: 'Abakunzwe Cyane' },
                { id: 'New Generation', label: 'Abashya (New Gen)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEraFilter(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  eraFilter === opt.id
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Translator Banner when filtered */}
      {subTab === 'films' && activeTranslator && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display text-base font-extrabold">
              {getInitials(activeTranslator.name)}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{activeTranslator.studio}</span>
                <span aria-hidden="true">·</span>
                <span>{activeTranslator.city}</span>
                <span aria-hidden="true">·</span>
                <span>{activeTranslator.era}</span>
              </div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {activeTranslator.name} — {activeTranslator.aka}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                {activeTranslator.bioKinyarwanda}
              </p>
              <p className="text-xs italic text-foreground/85">
                &ldquo;{activeTranslator.catchphrase}&rdquo;
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTranslator('all')}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0 self-start sm:self-center"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Reba Abasobanuzi Bose
          </button>
        </div>
      )}

      {/* Main Content */}
      {loading && !data ? (
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
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Habayeho ikibazo mu gufungura Agasobanuye. Ongera ugerageze.
          </p>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Ongera Ugerageze
          </button>
        </div>
      ) : subTab === 'films' ? (
        data && data.items.length > 0 ? (
          <div className="space-y-4">
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              Filimi {data.items.length} zisobanuye mu Kinyarwanda
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {data.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-1.5">
                  <MediaCard
                    item={item}
                    onSelect={onSelectMedia}
                    onPlayTrailer={onPlayTrailer}
                    onDownload={onDownload}
                    inWatchlist={isInWatchlist(item.id)}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                  {item.umusobanuzi && (
                    <button
                      type="button"
                      onClick={() => setTranslator(item.umusobanuzi!.id)}
                      className="px-1 text-left text-[11px] text-muted-foreground hover:text-primary transition-colors truncate"
                      title={`Reba izindi filimi za ${item.umusobanuzi.name}`}
                    >
                      Yasobanuwe na{' '}
                      <span className="font-semibold text-foreground">
                        {item.umusobanuzi.name}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Nta filimi ibonetse ku byo wahisemo.
            </p>
            <button
              type="button"
              onClick={() => {
                setTranslator('all');
                setCategory('all');
                setQuery('');
              }}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              Erekana Zose
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAbasobanuzi.map((u) => (
            <article
              key={u.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4 card-lift"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary font-display text-base font-extrabold border border-primary/25">
                      {getInitials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-bold text-foreground truncate">
                        {u.name}
                      </h2>
                      <p className="text-xs text-muted-foreground truncate">{u.aka}</p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <span>{u.studio}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{u.city}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-medium text-foreground">{u.era}</span>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed text-foreground/85">
                  {u.bioKinyarwanda}
                </p>

                <p className="text-xs italic text-muted-foreground">
                  &ldquo;{u.catchphrase}&rdquo;
                </p>

                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Ibyo asobanura: </span>
                  {u.specialty.join(' · ')}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setTranslator(u.id);
                    setSubTab('films');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Reba Filimi za {u.name}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
