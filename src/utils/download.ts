import type { CinemaDetailResponse, CinemaItem, DownloadHistoryEntry } from '../types/cinema';

export function sanitizeFilename(name: string, ext?: string): string {
  const clean = name
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'cineverse-media';
  if (!ext) return clean;
  return clean.toLowerCase().endsWith(ext.toLowerCase()) ? clean : `${clean}${ext}`;
}

export function inferMediaExtension(url: string, fallback = '.mp4'): string {
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.m4v')) return '.m4v';
  if (lower.endsWith('.mp4')) return '.mp4';
  if (lower.endsWith('.mov')) return '.mov';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return '.jpg';
  if (lower.endsWith('.png')) return '.png';
  if (lower.endsWith('.webp')) return '.webp';
  return fallback;
}

export function buildProxyDownloadUrl(url: string, filename: string): string {
  return `/api/cinema/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}

export function triggerFileDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadRemoteMedia(remoteUrl: string, title: string, fallbackExt = '.mp4'): void {
  const ext = inferMediaExtension(remoteUrl, fallbackExt);
  const filename = sanitizeFilename(title, ext);
  const proxyUrl = buildProxyDownloadUrl(remoteUrl, filename);
  triggerFileDownload(proxyUrl, filename);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  triggerFileDownload(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

export function buildCinemaInfoText(item: CinemaItem | CinemaDetailResponse): string {
  const lines: string[] = [
    `CINEVERSE CINEMA DOSSIER`,
    `========================`,
    `Title: ${item.title}`,
    item.originalTitle && item.originalTitle !== item.title ? `Original Title: ${item.originalTitle}` : '',
    `Format: ${item.type.toUpperCase()}`,
    `Release: ${item.releaseDate || item.year || 'N/A'}`,
    `Rating: ${item.rating.toFixed(1)} / 10`,
    item.runtimeMinutes ? `Runtime: ${item.runtimeMinutes} min` : '',
    item.genres.length ? `Genres: ${item.genres.join(', ')}` : '',
    item.director ? `Director / Creator: ${item.director}` : '',
    item.network ? `Network: ${item.network}` : '',
    item.umusobanuzi
      ? `Agasobanuye (Kinyarwanda): ${item.umusobanuzi.name} (${item.umusobanuzi.aka})`
      : '',
    '',
    `Overview`,
    `--------`,
    item.overview || 'No overview available.',
  ].filter((line) => line !== undefined);

  if ('cast' in item && item.cast.length > 0) {
    lines.push('', 'Cast & Credits', '--------------');
    item.cast.slice(0, 12).forEach((c) => {
      lines.push(`- ${c.name}${c.character ? ` as ${c.character}` : ''}`);
    });
  }

  if ('episodes' in item && item.episodes.length > 0) {
    lines.push('', `Episodes (${item.episodes.length} total)`, '--------------');
    item.episodes.slice(0, 30).forEach((ep) => {
      lines.push(`S${ep.season}E${ep.number}: ${ep.name}${ep.airdate ? ` (${ep.airdate})` : ''}`);
    });
  }

  if (item.externalUrl) {
    lines.push('', `Source: ${item.externalUrl}`);
  }

  return lines.join('\n');
}

export function buildWatchlistCsv(items: CinemaItem[]): string {
  const escape = (val: unknown) => {
    const str = String(val ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };

  const header = ['Title', 'Type', 'Year', 'Rating', 'Genres', 'Director/Network', 'Saved At', 'Link'];
  const rows = items.map((item) => [
    escape(item.title),
    escape(item.type),
    escape(item.year ?? ''),
    escape(item.rating.toFixed(1)),
    escape(item.genres.join(' | ')),
    escape(item.director || item.network || ''),
    escape(item.addedAt || ''),
    escape(item.externalUrl || ''),
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function createDownloadHistoryEntry(
  item: Pick<CinemaItem, 'id' | 'title' | 'posterUrl'>,
  kind: DownloadHistoryEntry['kind']
): Omit<DownloadHistoryEntry, 'id' | 'downloadedAt'> {
  return {
    mediaId: item.id,
    title: item.title,
    kind,
    posterUrl: item.posterUrl,
  };
}
