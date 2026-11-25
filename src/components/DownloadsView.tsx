import {
  BookmarkCheck,
  Download,
  FileJson,
  FileSpreadsheet,
  Film,
  History,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  CinemaDetailResponse,
  CinemaItem,
  DownloadHistoryEntry,
  DownloadsResponse,
} from '../types/cinema';
import {
  buildWatchlistCsv,
  createDownloadHistoryEntry,
  downloadRemoteMedia,
  downloadTextFile,
  formatBytes,
} from '../utils/download';
import { MediaImage } from './MediaImage';

interface DownloadsViewProps {
  onSelectMedia: (item: CinemaItem) => void;
  onPlayTrailer: (item: CinemaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: CinemaItem) => void;
  downloadHistory: DownloadHistoryEntry[];
  onRecordDownload: (entry: Omit<DownloadHistoryEntry, 'id' | 'downloadedAt'>) => void;
  onClearHistory: () => void;
  watchlist: CinemaItem[];
}

export function DownloadsView({
  onSelectMedia,
  onPlayTrailer,
  isInWatchlist,
  onToggleWatchlist,
  downloadHistory,
  onRecordDownload,
  onClearHistory,
  watchlist,
}: DownloadsViewProps) {
  const [subTab, setSubTab] = useState<'full' | 'trailers' | 'history'>('full');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<DownloadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveErrorId, setResolveErrorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch('/api/cinema/downloads')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load downloads');
        return res.json();
      })
      .then((resData: DownloadsResponse) => {
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
  }, [retryTick]);

  const handleDownloadFullMovie = async (item: CinemaItem) => {
    setResolveErrorId(null);
    if (item.downloadUrl) {
      downloadRemoteMedia(item.downloadUrl, item.title, '.mp4');
      onRecordDownload(createDownloadHistoryEntry(item, 'Full Movie'));
      return;
    }

    setResolvingId(item.id);
    try {
      const res = await fetch(
        `/api/cinema/item/${encodeURIComponent(item.id)}?title=${encodeURIComponent(item.title)}`
      );
      if (!res.ok) throw new Error('Failed to resolve file');
      const detail: CinemaDetailResponse = await res.json();
      const targetUrl = detail.downloadUrl || detail.downloadFiles?.[0]?.url || detail.trailerUrl;
      if (!targetUrl) throw new Error('No MP4 file found');
      downloadRemoteMedia(targetUrl, item.title, '.mp4');
      onRecordDownload(createDownloadHistoryEntry(item, 'Full Movie'));
    } catch {
      setResolveErrorId(item.id);
    } finally {
      setResolvingId(null);
    }
  };

  const handleDownloadTrailer = (item: CinemaItem) => {
    const url = item.downloadUrl || item.trailerUrl;
    if (!url) return;
    downloadRemoteMedia(url, `${item.title}-trailer`, '.m4v');
    onRecordDownload(createDownloadHistoryEntry(item, 'Trailer'));
  };

  const handleDownloadPoster = (item: CinemaItem) => {
    if (!item.posterUrl) return;
    downloadRemoteMedia(item.posterUrl, `${item.title}-poster`, '.jpg');
    onRecordDownload(createDownloadHistoryEntry(item, 'Poster'));
  };

  const qLower = query.trim().toLowerCase();
  const filteredFull = (data?.fullMovies || []).filter(
    (m) =>
      !qLower ||
      m.title.toLowerCase().includes(qLower) ||
      (m.director || '').toLowerCase().includes(qLower) ||
      m.genres.some((g) => g.toLowerCase().includes(qLower))
  );

  const filteredTrailers = (data?.trailers || []).filter(
    (m) =>
      !qLower ||
      m.title.toLowerCase().includes(qLower) ||
      (m.director || '').toLowerCase().includes(qLower) ||
      m.genres.some((g) => g.toLowerCase().includes(qLower))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Downloads Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Download full-length public-domain MP4 feature films, official movie trailers, high-resolution posters, and your saved watchlist exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('full')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'full'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Film className="h-3.5 w-3.5" aria-hidden="true" />
            Full Movies ({data ? data.totalFullMovies : '—'})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('trailers')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'trailers'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
            Trailers ({data ? data.totalTrailers : '—'})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'history'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            My Downloads ({downloadHistory.length})
          </button>
        </div>
      </div>

      {subTab !== 'history' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                subTab === 'full'
                  ? 'Filter downloadable full movies by title, director, or genre...'
                  : 'Filter downloadable trailers by title, director, or genre...'
              }
              aria-label="Filter downloadable cinema"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {subTab === 'full'
              ? `${filteredFull.length} MP4 feature films`
              : `${filteredTrailers.length} official trailers`}
          </span>
        </div>
      )}

      {loading && subTab !== 'history' ? (
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
      ) : error && subTab !== 'history' ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Could not load downloadable cinema right now.
          </p>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : subTab === 'full' ? (
        filteredFull.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFull.map((item) => {
              const primaryFile = item.downloadFiles?.[0];
              const sizeStr = formatBytes(primaryFile?.sizeBytes);
              const isResolving = resolvingId === item.id;
              const saved = isInWatchlist(item.id);

              return (
                <article
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-border bg-card card-lift"
                >
                  <div className="flex gap-3.5 p-3.5 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelectMedia(item)}
                      className="w-24 shrink-0 aspect-[2/3] overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <MediaImage
                        src={item.posterUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </button>

                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => onSelectMedia(item)}
                          className="text-left text-sm font-bold text-foreground hover:text-primary transition-colors line-clamp-2"
                        >
                          {item.title}
                        </button>
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {item.year ?? 'Classic'} · Full Movie · MP4
                          {sizeStr ? ` (${sizeStr})` : ''}
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {item.overview}
                        </p>
                      </div>

                      <div className="mt-2 text-[11px] text-muted-foreground truncate">
                        {item.director || 'Public Domain Cinema'}
                      </div>
                    </div>
                  </div>

                  {resolveErrorId === item.id && (
                    <p className="px-3.5 pb-2 text-xs text-primary">
                      MP4 stream unavailable for this archive record. Open Details for options.
                    </p>
                  )}

                  <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3.5 py-2.5">
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={() => handleDownloadFullMovie(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          Preparing...
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Download MP4
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        item.trailerUrl ? onPlayTrailer(item) : onSelectMedia(item)
                      }
                      aria-label={`Watch ${item.title}`}
                      className="inline-flex items-center justify-center rounded-md border border-border bg-card p-1.5 text-foreground hover:bg-muted transition-colors"
                      title="Watch"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPoster(item)}
                      aria-label={`Download poster for ${item.title}`}
                      className="inline-flex items-center justify-center rounded-md border border-border bg-card p-1.5 text-foreground hover:bg-muted transition-colors"
                      title="Download Poster"
                    >
                      <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleWatchlist(item)}
                      aria-label={saved ? 'Remove from watchlist' : 'Save to watchlist'}
                      className={`inline-flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        saved
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                      title="Watchlist"
                    >
                      <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No full movies matched &ldquo;{query}&rdquo;.
          </div>
        )
      ) : subTab === 'trailers' ? (
        filteredTrailers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTrailers.map((item) => (
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
                      {item.year ?? 'New'} · {item.genres[0] || 'Cinema'} · M4V
                    </div>
                    <h3 className="font-display text-base font-bold truncate">{item.title}</h3>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
                  <span className="truncate">{item.director || 'Feature Film'}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadTrailer(item)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPoster(item)}
                      aria-label={`Download poster for ${item.title}`}
                      className="inline-flex items-center justify-center rounded-md border border-border p-1.5 text-foreground hover:bg-muted transition-colors"
                      title="Download Poster"
                    >
                      <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectMedia(item)}
                      className="font-semibold text-primary hover:underline px-1 whitespace-nowrap"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No trailers matched &ldquo;{query}&rdquo;.
          </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Watchlist Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h2 className="font-display text-base font-bold text-foreground">
                Export Your Saved Cinema Library
              </h2>
              <p className="text-xs text-muted-foreground">
                Save your {watchlist.length} watchlist titles offline as JSON or CSV spreadsheets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={watchlist.length === 0}
                onClick={() =>
                  downloadTextFile(
                    JSON.stringify(watchlist, null, 2),
                    'cineverse-watchlist.json',
                    'application/json;charset=utf-8'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                Export JSON
              </button>
              <button
                type="button"
                disabled={watchlist.length === 0}
                onClick={() =>
                  downloadTextFile(
                    buildWatchlistCsv(watchlist),
                    'cineverse-watchlist.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                Export CSV
              </button>
            </div>
          </div>

          {downloadHistory.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Recent Downloads ({downloadHistory.length})
                </h2>
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear History
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {downloadHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      <MediaImage
                        src={entry.posterUrl || ''}
                        alt={entry.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {entry.title}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {entry.kind} · {new Date(entry.downloadedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No downloads recorded yet. Download any full movie, trailer, poster, or info dossier to see it here.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
