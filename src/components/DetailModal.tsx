import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Heart,
  Image as ImageIcon,
  Play,
  Share2,
  Star,
  Tv,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type {
  CinemaDetailResponse,
  CinemaItem,
  DownloadHistoryEntry,
  PersonDetailResponse,
  UserReview,
} from '../types/cinema';
import {
  buildCinemaInfoText,
  createDownloadHistoryEntry,
  downloadRemoteMedia,
  downloadTextFile,
  formatBytes,
  sanitizeFilename,
} from '../utils/download';
import { MediaCard } from './MediaCard';
import { MediaImage } from './MediaImage';

interface MediaDetailModalProps {
  item: CinemaItem | null;
  onClose: () => void;
  onSelectMedia: (item: CinemaItem) => void;
  onSelectPerson: (person: { id: string; name: string; imageUrl?: string }) => void;
  onSelectGenre: (genre: string) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: CinemaItem) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (item: CinemaItem) => void;
  reviews: UserReview[];
  onAddReview: (mediaId: string, mediaTitle: string, rating: number, text: string) => void;
  onRecordDownload?: (entry: Omit<DownloadHistoryEntry, 'id' | 'downloadedAt'>) => void;
}

export function MediaDetailModal({
  item,
  onClose,
  onSelectMedia,
  onSelectPerson,
  onSelectGenre,
  isInWatchlist,
  onToggleWatchlist,
  isFavorite,
  onToggleFavorite,
  reviews,
  onAddReview,
  onRecordDownload,
}: MediaDetailModalProps) {
  const [detail, setDetail] = useState<CinemaDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [reviewRating, setReviewRating] = useState(9);
  const [reviewText, setReviewText] = useState('');
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) {
      setDetail(null);
      setDetailError(false);
      setPlayingTrailer(false);
      setCopied(false);
      setReviewText('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetailError(false);
    setPlayingTrailer(false);
    setCopied(false);
    setReviewText('');
    backdropRef.current?.scrollTo({ top: 0 });

    const url = `/api/cinema/item/${encodeURIComponent(item.id)}?title=${encodeURIComponent(item.title)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Detail unavailable');
        return res.json();
      })
      .then((data: CinemaDetailResponse) => {
        if (!cancelled) {
          setDetail(data);
          if (data.seasons && data.seasons.length > 0) {
            setSelectedSeason(data.seasons[0]);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setDetailError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  if (!item) return null;

  const active = detail
    ? {
        ...detail,
        umusobanuzi: detail.umusobanuzi || item.umusobanuzi,
        kinyarwandaCategory: detail.kinyarwandaCategory || item.kinyarwandaCategory,
      }
    : {
        ...item,
        cast: [],
        episodes: [],
        seasons: [],
        similar: [],
      };

  const saved = isInWatchlist(active.id);
  const fav = isFavorite(active.id);
  const itemReviews = reviews.filter((r) => r.mediaId === active.id);
  const seasonEpisodes = active.episodes.filter((ep) => ep.season === selectedSeason);

  const handleReviewSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    onAddReview(active.id, active.title, reviewRating, reviewText);
    setReviewText('');
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/?item=${encodeURIComponent(active.id)}&title=${encodeURIComponent(active.title)}`;
    let didCopy = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        didCopy = true;
      }
    } catch {
      didCopy = false;
    }
    if (!didCopy) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        didCopy = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        didCopy = false;
      }
    }
    if (didCopy) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={active.title}
      onClick={onClose}
    >
      <div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail view"
          className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-primary transition-colors"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Backdrop or Embedded Video Trailer */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-muted">
          {playingTrailer && active.trailerUrl ? (
            <video
              src={active.trailerUrl}
              controls
              autoPlay
              playsInline
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            <>
              <MediaImage
                src={active.backdropUrl || active.posterUrl}
                alt={active.title}
                className="h-full w-full object-cover opacity-75"
              />
              <div className="absolute inset-0 hero-overlay" />
              {active.trailerUrl && (
                <button
                  type="button"
                  onClick={() => setPlayingTrailer(true)}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl hover:bg-primary/90 transition-transform hover:scale-105"
                >
                  <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                  {active.isFullMovie ? 'Play Full Movie' : 'Play Official Trailer'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Main Content */}
        <div className="px-5 pb-8 pt-4 sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Poster */}
            <div className="hidden md:block w-48 shrink-0 -mt-20 relative z-20">
              <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                <MediaImage
                  src={active.posterUrl}
                  alt={active.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Title & Info */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                <span className="font-semibold text-primary">
                  {active.type === 'tv' ? 'TV Series' : active.type === 'anime' ? 'Anime Cinema' : 'Feature Film'}
                </span>
                {active.releaseDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      {active.releaseDate}
                    </span>
                  </>
                )}
                {active.runtimeMinutes && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {active.runtimeMinutes} min
                    </span>
                  </>
                )}
                {active.advisoryRating && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{active.advisoryRating}</span>
                  </>
                )}
                {active.network && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Tv className="h-3.5 w-3.5" aria-hidden="true" />
                      {active.network}
                    </span>
                  </>
                )}
              </div>

              <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {active.title}
              </h2>

              {active.originalTitle && active.originalTitle !== active.title && (
                <p className="text-sm text-muted-foreground">{active.originalTitle}</p>
              )}

              {/* Rating & Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5">
                  <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                    {active.rating.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 10</span>
                </div>

                {active.trailerUrl && (
                  <button
                    type="button"
                    onClick={() => setPlayingTrailer((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    {playingTrailer
                      ? active.isFullMovie
                        ? 'Hide Movie'
                        : 'Hide Trailer'
                      : active.isFullMovie
                        ? 'Watch Full Movie'
                        : 'Watch Trailer'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onToggleWatchlist(active)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {saved ? (
                    <>
                      <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                      Watchlist
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(active)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Heart
                    className={`h-4 w-4 ${fav ? 'fill-primary text-primary' : ''}`}
                    aria-hidden="true"
                  />
                  {fav ? 'Favorited' : 'Favorite'}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  aria-label={copied ? 'Link copied to clipboard' : `Share ${active.title}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      Share
                    </>
                  )}
                </button>

                {active.externalUrl && (
                  <a
                    href={active.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Source
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>

              {/* Genres (Interactive Filter Buttons) */}
              <div className="flex flex-wrap items-center gap-2">
                {active.genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      onSelectGenre(genre);
                      onClose();
                    }}
                    className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {genre}
                  </button>
                ))}
              </div>

              <p className="text-sm sm:text-base leading-relaxed text-foreground/90">
                {active.overview}
              </p>

              {active.director && (
                <p className="text-sm text-muted-foreground">
                  Director / Creator:{' '}
                  <span className="font-semibold text-foreground">{active.director}</span>
                </p>
              )}

              {active.umusobanuzi && (
                <p className="text-sm text-muted-foreground">
                  Yasobanuwe mu Kinyarwanda na{' '}
                  <span className="font-semibold text-primary">
                    {active.umusobanuzi.name}
                  </span>{' '}
                  ({active.umusobanuzi.aka})
                </p>
              )}

              {/* Download Options */}
              <div className="rounded-lg border border-border bg-card/80 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Download Options
                  </span>
                  {active.isFullMovie && (
                    <span className="text-xs font-medium text-primary">
                      Public Domain Full Feature · MP4
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {active.downloadFiles && active.downloadFiles.length > 0 ? (
                    active.downloadFiles.map((file, idx) => {
                      const sizeLabel = formatBytes(file.sizeBytes);
                      return (
                        <button
                          key={`${file.url}-${idx}`}
                          type="button"
                          onClick={() => {
                            downloadRemoteMedia(file.url, active.title, '.mp4');
                            onRecordDownload?.(createDownloadHistoryEntry(active, 'Full Movie'));
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{file.label}</span>
                          {sizeLabel && (
                            <span className="font-mono text-[11px] opacity-90 tabular-nums">
                              ({sizeLabel})
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (active.downloadUrl || active.trailerUrl) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = active.downloadUrl || active.trailerUrl;
                        if (!target) return;
                        downloadRemoteMedia(
                          target,
                          active.isFullMovie ? active.title : `${active.title}-trailer`,
                          active.isFullMovie ? '.mp4' : '.m4v'
                        );
                        onRecordDownload?.(
                          createDownloadHistoryEntry(
                            active,
                            active.isFullMovie ? 'Full Movie' : 'Trailer'
                          )
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {active.isFullMovie ? 'Download Full Movie (.mp4)' : 'Download Trailer (.m4v)'}
                    </button>
                  ) : null}

                  {active.posterUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        downloadRemoteMedia(active.posterUrl, `${active.title}-poster`, '.jpg');
                        onRecordDownload?.(createDownloadHistoryEntry(active, 'Poster'));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                    >
                      <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Poster (.jpg)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      downloadTextFile(
                        buildCinemaInfoText(active),
                        sanitizeFilename(`${active.title}-info`, '.txt')
                      );
                      onRecordDownload?.(createDownloadHistoryEntry(active, 'Info Card'));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Info Dossier (.txt)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg shimmer" />
              ))}
            </div>
          )}

          {!loading && detailError && (
            <p className="mt-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Additional cast and episode details could not be loaded right now. Showing summary metadata.
            </p>
          )}

          {/* Cast Section */}
          {active.cast.length > 0 && (
            <section className="mt-8 border-t border-border pt-6">
              <h3 className="font-display text-lg font-bold text-foreground mb-4">
                Cast &amp; Credits
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {active.cast.slice(0, 12).map((member) => (
                  <button
                    key={`${member.id}-${member.name}`}
                    type="button"
                    onClick={() =>
                      onSelectPerson({
                        id: member.id,
                        name: member.name,
                        imageUrl: member.imageUrl,
                      })
                    }
                    className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/50"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
                      <MediaImage
                        src={member.imageUrl}
                        alt={member.name}
                        fallbackKind="person"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-semibold text-foreground line-clamp-1">
                        {member.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">
                        {member.character}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* TV Episodes Guide */}
          {active.episodes.length > 0 && (
            <section className="mt-8 border-t border-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-display text-lg font-bold text-foreground">
                  Episodes Guide
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {active.seasons.slice(0, 12).map((season) => (
                    <button
                      key={season}
                      type="button"
                      onClick={() => setSelectedSeason(season)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold tabular-nums transition-colors ${
                        selectedSeason === season
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Season {season}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {seasonEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    {ep.imageUrl && (
                      <div className="h-16 w-28 shrink-0 overflow-hidden rounded bg-muted">
                        <MediaImage
                          src={ep.imageUrl}
                          alt={ep.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-muted-foreground tabular-nums">
                        S{ep.season} · E{ep.number}
                        {ep.airdate ? ` · ${ep.airdate}` : ''}
                      </div>
                      <div className="text-sm font-semibold text-foreground truncate">
                        {ep.name}
                      </div>
                      {ep.summary && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {ep.summary}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Community Reviews */}
          <section className="mt-8 border-t border-border pt-6">
            <h3 className="font-display text-lg font-bold text-foreground mb-4">
              Your Review &amp; Rating
            </h3>
            <form onSubmit={handleReviewSubmit} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="review-score" className="text-xs font-medium text-muted-foreground">
                  Score (1–10)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="review-score"
                    type="range"
                    min={1}
                    max={10}
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="accent-primary"
                  />
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums w-8 text-right">
                    {reviewRating}/10
                  </span>
                </div>
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={2}
                placeholder={`Share your thoughts on ${active.title}...`}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!reviewText.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  Post Review
                </button>
              </div>
            </form>

            {itemReviews.length > 0 && (
              <div className="mt-4 space-y-3">
                {itemReviews.map((rev) => (
                  <div key={rev.id} className="rounded-lg border border-border bg-card p-3.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-semibold text-foreground">{rev.author}</span>
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-foreground tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
                        {rev.rating}/10
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90">{rev.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Similar Cinema */}
          {active.similar.length > 0 && (
            <section className="mt-8 border-t border-border pt-6">
              <h3 className="font-display text-lg font-bold text-foreground mb-4">
                Similar Titles
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {active.similar.slice(0, 6).map((sim) => (
                  <MediaCard
                    key={sim.id}
                    item={sim}
                    onSelect={onSelectMedia}
                    inWatchlist={isInWatchlist(sim.id)}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

interface PersonDetailModalProps {
  person: { id: string; name: string; imageUrl?: string } | null;
  onClose: () => void;
  onSelectMedia: (item: CinemaItem) => void;
}

export function PersonDetailModal({
  person,
  onClose,
  onSelectMedia,
}: PersonDetailModalProps) {
  const [detail, setDetail] = useState<PersonDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!person) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetch(
      `/api/cinema/person/${encodeURIComponent(person.id)}?name=${encodeURIComponent(person.name)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PersonDetailResponse | null) => {
        if (!cancelled && data) setDetail(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [person]);

  if (!person) return null;

  const displayName = detail?.name || person.name;
  const displayImg = detail?.imageUrl || person.imageUrl;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={displayName}
      onClick={onClose}
    >
      <div
        className="relative mx-auto max-w-3xl rounded-xl border border-border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close person profile"
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-32 sm:w-40 shrink-0 aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted">
            <MediaImage
              src={displayImg}
              alt={displayName}
              fallbackKind="person"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-2.5 flex-1">
            <p className="text-xs font-semibold text-primary">Film &amp; Television Talent</p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              {displayName}
            </h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
              {detail?.country && <span>{detail.country}</span>}
              {detail?.birthday && (
                <>
                  {detail.country && <span aria-hidden="true">·</span>}
                  <span className="tabular-nums">Born {detail.birthday}</span>
                </>
              )}
              {detail?.knownFor && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{detail.knownFor}</span>
                </>
              )}
            </div>
            {detail?.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
              >
                Full Profile
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-display text-base font-bold text-foreground mb-3">
            Known For &amp; Credits
          </h3>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-lg shimmer" />
              ))}
            </div>
          ) : detail && detail.credits.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detail.credits.map((credit, idx) => (
                <button
                  key={`${credit.media.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectMedia(credit.media);
                  }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-left hover:border-primary/50 transition-colors"
                >
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-muted">
                    <MediaImage
                      src={credit.media.posterUrl}
                      alt={credit.media.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {credit.media.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      as {credit.character}
                    </div>
                    <div className="mt-1 text-xs font-mono text-muted-foreground tabular-nums">
                      {credit.media.year ?? 'Series'} · ★ {credit.media.rating.toFixed(1)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No additional cast credits indexed for this person yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface TrailerModalProps {
  item: CinemaItem | null;
  onClose: () => void;
  onOpenDetail: (item: CinemaItem) => void;
  onRecordDownload?: (entry: Omit<DownloadHistoryEntry, 'id' | 'downloadedAt'>) => void;
}

export function TrailerModal({
  item,
  onClose,
  onOpenDetail,
  onRecordDownload,
}: TrailerModalProps) {
  if (!item) return null;

  const downloadableMediaUrl = item.downloadUrl || item.trailerUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Trailer for ${item.title}`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-foreground truncate">
              {item.title} — {item.isFullMovie ? 'Full Feature Film' : 'Official Preview'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {item.year ?? ''} · {item.genres.slice(0, 2).join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {downloadableMediaUrl && (
              <button
                type="button"
                onClick={() => {
                  downloadRemoteMedia(
                    downloadableMediaUrl,
                    item.isFullMovie ? item.title : `${item.title}-trailer`,
                    item.isFullMovie ? '.mp4' : '.m4v'
                  );
                  onRecordDownload?.(
                    createDownloadHistoryEntry(
                      item,
                      item.isFullMovie ? 'Full Movie' : 'Trailer'
                    )
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDetail(item);
              }}
              className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors whitespace-nowrap"
            >
              View Details
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close trailer"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="aspect-video w-full bg-black flex items-center justify-center">
          {item.trailerUrl ? (
            <video
              src={item.trailerUrl}
              controls
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Trailer stream unavailable for this title.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
