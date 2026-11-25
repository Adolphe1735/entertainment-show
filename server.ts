import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import type {
  AgasobanuyeResponse,
  CalendarResponse,
  CastMember,
  CinemaDetailResponse,
  CinemaItem,
  DiscoverResponse,
  DownloadFileOption,
  DownloadsResponse,
  EpisodeItem,
  HomeCinemaResponse,
  PersonDetailResponse,
  PersonItem,
  SearchResponse,
  Umusobanuzi,
} from './src/types/cinema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): T {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CineVerse/1.0 (+https://cineverse.local)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function upscaleItunesArtwork(url: string, size = '600x900bb.jpg'): string {
  if (!url) return '';
  return url.replace(/\/\d+x\d+[^/]*\.(png|jpg|jpeg|webp)$/i, `/${size}`);
}

function parseYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

// ---------- ITUNES MOVIE NORMALIZER ----------
interface ItunesRssEntry {
  'im:name'?: { label: string };
  'im:image'?: Array<{ label: string; attributes?: { height?: string } }>;
  summary?: { label: string };
  'im:price'?: { label: string };
  title?: { label: string };
  link?: Array<{ attributes?: { rel?: string; type?: string; href?: string } }>;
  id?: { label?: string; attributes?: { 'im:id'?: string } };
  'im:artist'?: { label: string };
  category?: { attributes?: { label?: string } };
  'im:releaseDate'?: { label: string; attributes?: { label?: string } };
}

interface ItunesRssFeed {
  feed?: {
    entry?: ItunesRssEntry | ItunesRssEntry[];
  };
}

function normalizeItunesEntry(entry: ItunesRssEntry, index: number, country = 'US'): CinemaItem | null {
  const rawId = entry.id?.attributes?.['im:id'];
  const rawTitle = entry['im:name']?.label || entry.title?.label;
  if (!rawId || !rawTitle) return null;

  const images = entry['im:image'] || [];
  const rawImg = images[images.length - 1]?.label || '';
  const posterUrl = upscaleItunesArtwork(rawImg, '600x900bb.jpg');
  const backdropUrl = upscaleItunesArtwork(rawImg, '1200x1200bb.jpg');

  const previewLink = (entry.link || []).find(
    (l) => l.attributes?.rel === 'enclosure' || (l.attributes?.type || '').startsWith('video/')
  );
  const altLink = (entry.link || []).find((l) => l.attributes?.rel === 'alternate');

  const releaseDate = entry['im:releaseDate']?.label || '';
  const year = parseYear(releaseDate) || parseYear(rawTitle);
  const genre = entry.category?.attributes?.label || 'Cinema';

  // Derive deterministic editorial score in 6.8 - 9.1 range when RSS omits rating
  const baseScore = Math.max(6.4, Math.min(9.1, 8.8 - index * 0.032));
  const rating = Number(baseScore.toFixed(1));

  return {
    id: `itunes:${rawId}`,
    source: 'itunes',
    rawId,
    type: genre.toLowerCase().includes('anime') ? 'anime' : 'movie',
    title: rawTitle,
    overview: stripHtml(entry.summary?.label) || `${rawTitle} — directed by ${entry['im:artist']?.label || 'acclaimed filmmaker'}.`,
    posterUrl,
    backdropUrl,
    trailerUrl: previewLink?.attributes?.href,
    externalUrl: altLink?.attributes?.href,
    releaseDate: entry['im:releaseDate']?.attributes?.label || releaseDate.slice(0, 10),
    year,
    rating,
    genres: genre.includes('&')
      ? genre.split('&').map((g) => g.trim())
      : [genre],
    director: entry['im:artist']?.label || 'Various Directors',
    price: entry['im:price']?.label,
    country,
    rank: index + 1,
  };
}

const ITUNES_GENRE_FEEDS: Array<{ code: number; label: string }> = [
  { code: 4401, label: 'Action & Adventure' },
  { code: 4413, label: 'Sci-Fi & Fantasy' },
  { code: 4406, label: 'Drama' },
  { code: 4416, label: 'Thriller' },
  { code: 4404, label: 'Comedy' },
  { code: 4408, label: 'Horror' },
  { code: 4402, label: 'Animation' },
  { code: 4405, label: 'Documentary' },
  { code: 4412, label: 'Romance' },
  { code: 4403, label: 'Classics' },
  { code: 4410, label: 'Kids & Family' },
];

async function fetchItunesRss(url: string, country = 'US'): Promise<CinemaItem[]> {
  const cached = getCached<CinemaItem[]>(`rss:${url}`);
  if (cached) return cached;

  const data = await fetchJson<ItunesRssFeed>(url, 9000);
  const rawEntries = data?.feed?.entry;
  const list = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : [];
  const items: CinemaItem[] = [];
  list.forEach((entry, idx) => {
    const normalized = normalizeItunesEntry(entry, idx, country);
    if (normalized) items.push(normalized);
  });
  return setCached(`rss:${url}`, items);
}

// ---------- TVMAZE NORMALIZER ----------
interface TvMazeShow {
  id: number;
  url?: string;
  name: string;
  type?: string;
  language?: string;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  premiered?: string | null;
  rating?: { average?: number | null };
  weight?: number;
  network?: { name?: string; country?: { name?: string; code?: string } } | null;
  webChannel?: { name?: string; country?: { name?: string; code?: string } } | null;
  image?: { medium?: string; original?: string } | null;
  summary?: string | null;
  _embedded?: {
    cast?: Array<{
      person: { id: number; name: string; image?: { medium?: string; original?: string } | null; country?: { name?: string } | null; birthday?: string | null };
      character: { name: string; image?: { medium?: string; original?: string } | null };
    }>;
    episodes?: Array<{
      id: number;
      name: string;
      season: number;
      number: number;
      airdate: string;
      runtime: number;
      summary?: string | null;
      image?: { medium?: string; original?: string } | null;
    }>;
  };
}

function normalizeTvMazeShow(show: TvMazeShow): CinemaItem {
  const poster = show.image?.medium || show.image?.original || '';
  const backdrop = show.image?.original || show.image?.medium || '';
  const rating = show.rating?.average ? Number(show.rating.average.toFixed(1)) : 7.2;
  const releaseDate = show.premiered || '';
  const isAnime = show.type === 'Animation' && show.language === 'Japanese';

  return {
    id: `tvmaze:${show.id}`,
    source: 'tvmaze',
    rawId: String(show.id),
    type: isAnime ? 'anime' : 'tv',
    title: show.name,
    overview: stripHtml(show.summary) || `${show.name} television series.`,
    posterUrl: poster,
    backdropUrl: backdrop,
    externalUrl: show.url,
    releaseDate,
    year: parseYear(releaseDate),
    rating,
    runtimeMinutes: show.averageRuntime || show.runtime || undefined,
    genres: show.genres && show.genres.length > 0 ? show.genres : ['Drama'],
    network: show.network?.name || show.webChannel?.name || 'Broadcast',
    status: show.status,
    country: show.network?.country?.code || show.webChannel?.country?.code || 'US',
  };
}

// ---------- STUDIO GHIBLI NORMALIZER ----------
interface GhibliFilm {
  id: string;
  title: string;
  original_title?: string;
  image: string;
  movie_banner: string;
  description: string;
  director: string;
  producer: string;
  release_date: string;
  running_time: string;
  rt_score: string;
}

async function fetchGhibliFilms(): Promise<CinemaItem[]> {
  const cached = getCached<CinemaItem[]>('ghibli:all');
  if (cached) return cached;

  const data = await fetchJson<GhibliFilm[]>('https://ghibliapi.vercel.app/films', 9000);
  if (!Array.isArray(data)) return [];
  const items: CinemaItem[] = data.map((f) => ({
    id: `ghibli:${f.id}`,
    source: 'ghibli',
    rawId: f.id,
    type: 'anime',
    title: f.title,
    originalTitle: f.original_title,
    overview: f.description,
    posterUrl: f.image,
    backdropUrl: f.movie_banner || f.image,
    releaseDate: f.release_date,
    year: Number(f.release_date) || null,
    rating: Number((Math.min(9.6, Math.max(6.8, Number(f.rt_score || 85) / 10))).toFixed(1)),
    runtimeMinutes: Number(f.running_time) || undefined,
    genres: ['Animation', 'Fantasy', 'Adventure'],
    director: f.director,
    country: 'JP',
    status: 'Released',
  }));
  return setCached('ghibli:all', items);
}

// ---------- INTERNET ARCHIVE PUBLIC-DOMAIN FULL MOVIES (MP4) ----------
interface ArchiveSearchDoc {
  identifier: string;
  title?: string;
  year?: string | number;
  description?: string | string[];
  creator?: string | string[];
  subject?: string | string[];
  downloads?: number;
}

const ARCHIVE_BLOCKLIST = /\b(nudist|nude|sex|erotic|exploitation|burlesque|strip|adult|xxx)\b/i;

async function getArchiveMoviesCatalog(): Promise<CinemaItem[]> {
  const cached = getCached<CinemaItem[]>('archive:catalog');
  if (cached) return cached;

  const query =
    'mediatype:movies AND collection:feature_films AND format:MPEG4 AND year:[1940 TO 2024]';
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
    query
  )}&fl[]=identifier,title,year,description,creator,subject,downloads&sort[]=downloads+desc&rows=60&output=json`;

  const data = await fetchJson<{ response?: { docs?: ArchiveSearchDoc[] } }>(url, 10000);
  const docs = data?.response?.docs || [];

  const items: CinemaItem[] = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (!doc.identifier || !doc.title) continue;
    const rawDesc = Array.isArray(doc.description)
      ? doc.description.join(' ')
      : doc.description || '';
    const rawSubj = Array.isArray(doc.subject) ? doc.subject.join(' ') : doc.subject || '';
    const checkText = `${doc.title} ${rawDesc} ${rawSubj}`;
    if (ARCHIVE_BLOCKLIST.test(checkText)) continue;

    const cleanOverview =
      stripHtml(rawDesc) || `${doc.title} — public domain feature film available to watch and download in MP4.`;
    const thumb = `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`;
    const yearNum = parseYear(String(doc.year || ''));
    const creator = Array.isArray(doc.creator) ? doc.creator[0] : doc.creator;

    const genreCandidates = rawSubj
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 22 && !/feature|film|movie|public domain/i.test(s))
      .slice(0, 2);

    items.push({
      id: `archive:${doc.identifier}`,
      source: 'archive',
      rawId: doc.identifier,
      type: 'movie',
      title: doc.title,
      overview: cleanOverview,
      posterUrl: thumb,
      backdropUrl: thumb,
      isFullMovie: true,
      externalUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
      releaseDate: yearNum ? String(yearNum) : '',
      year: yearNum,
      rating: Number(Math.max(6.8, Math.min(8.9, 8.5 - items.length * 0.03)).toFixed(1)),
      genres: genreCandidates.length > 0 ? ['Classics', ...genreCandidates] : ['Classics', 'Free Full Movie'],
      director: creator || 'Public Domain Cinema',
      country: 'US',
      status: 'Free MP4 Download',
    });
  }

  return setCached('archive:catalog', items.slice(0, 48));
}

async function resolveArchiveDownloadFiles(identifier: string): Promise<DownloadFileOption[]> {
  const key = `archive:files:${identifier}`;
  const cached = getCached<DownloadFileOption[]>(key);
  if (cached) return cached;

  interface ArchiveMetaFile {
    name: string;
    format?: string;
    size?: string | number;
  }
  const meta = await fetchJson<{ files?: ArchiveMetaFile[] }>(
    `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
    9000
  );
  const files = (meta?.files || [])
    .filter((f) => f.name.toLowerCase().endsWith('.mp4') && !f.name.includes('_thumb'))
    .sort((a, b) => Number(a.size || 0) - Number(b.size || 0));

  const options: DownloadFileOption[] = files.slice(0, 4).map((f) => {
    const sizeBytes = Number(f.size || 0) || undefined;
    const isCompact = f.name.includes('512kb') || (sizeBytes !== undefined && sizeBytes < 450_000_000);
    return {
      label: isCompact ? 'Standard MP4 (Fast Download)' : 'High Quality MP4',
      url: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(f.name)}`,
      sizeBytes,
      format: 'MP4',
    };
  });

  return setCached(key, options);
}

// ---------- AGGREGATED CATALOG ----------
async function getTvMazeCatalog(): Promise<CinemaItem[]> {
  const cached = getCached<CinemaItem[]>('tvmaze:catalog');
  if (cached) return cached;

  const pages = await Promise.all([
    fetchJson<TvMazeShow[]>('https://api.tvmaze.com/shows?page=0', 9000),
    fetchJson<TvMazeShow[]>('https://api.tvmaze.com/shows?page=1', 9000),
    fetchJson<TvMazeShow[]>('https://api.tvmaze.com/shows?page=2', 9000),
  ]);

  const combined: CinemaItem[] = [];
  for (const page of pages) {
    if (!Array.isArray(page)) continue;
    for (const s of page) {
      if (s.image?.medium) {
        combined.push(normalizeTvMazeShow(s));
      }
    }
  }
  combined.sort((a, b) => b.rating - a.rating);
  return setCached('tvmaze:catalog', combined);
}

async function getMoviesCatalog(region = 'us'): Promise<CinemaItem[]> {
  const key = `movies:catalog:${region}`;
  const cached = getCached<CinemaItem[]>(key);
  if (cached) return cached;

  const feeds = [
    fetchItunesRss(`https://itunes.apple.com/${region}/rss/topmovies/limit=100/json`, region.toUpperCase()),
    ...ITUNES_GENRE_FEEDS.slice(0, 8).map((g) =>
      fetchItunesRss(
        `https://itunes.apple.com/${region}/rss/topmovies/limit=35/genre=${g.code}/json`,
        region.toUpperCase()
      )
    ),
  ];

  const results = await Promise.all(feeds);
  const map = new Map<string, CinemaItem>();
  for (const list of results) {
    for (const item of list) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const mergedGenres = Array.from(new Set([...existing.genres, ...item.genres]));
        existing.genres = mergedGenres;
      }
    }
  }
  return setCached(key, Array.from(map.values()));
}

async function getPeopleCatalog(page = 0): Promise<PersonItem[]> {
  const key = `people:page:${page}`;
  const cached = getCached<PersonItem[]>(key);
  if (cached) return cached;

  interface TvMazePerson {
    id: number;
    url?: string;
    name: string;
    country?: { name?: string } | null;
    birthday?: string | null;
    gender?: string | null;
    image?: { medium?: string; original?: string } | null;
  }

  const raw = await fetchJson<TvMazePerson[]>(`https://api.tvmaze.com/people?page=${page}`, 9000);
  if (!Array.isArray(raw)) return [];
  const people: PersonItem[] = raw
    .filter((p) => Boolean(p.image?.medium || p.image?.original))
    .slice(0, 60)
    .map((p) => ({
      id: `tvmaze-person:${p.id}`,
      source: 'tvmaze',
      rawId: String(p.id),
      name: p.name,
      imageUrl: p.image?.original || p.image?.medium || '',
      country: p.country?.name || undefined,
      birthday: p.birthday || undefined,
      gender: p.gender || undefined,
      knownFor: 'Actor',
      url: p.url,
    }));

  return setCached(key, people);
}

// ---------- IMDB SUGGESTION GRAPH SEARCH ----------
interface ImdbSuggestItem {
  id: string;
  l: string;
  q?: string;
  qid?: string;
  rank?: number;
  s?: string;
  y?: number;
  i?: { imageUrl?: string; width?: number; height?: number };
}

async function searchImdbSuggestions(query: string): Promise<{ media: CinemaItem[]; people: PersonItem[] }> {
  const clean = query.trim().toLowerCase();
  if (!clean) return { media: [], people: [] };
  const firstChar = clean[0].replace(/[^a-z0-9]/g, 'x') || 'x';
  const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(clean)}.json`;
  const data = await fetchJson<{ d?: ImdbSuggestItem[] }>(url, 7000);
  const rows = data?.d || [];

  const media: CinemaItem[] = [];
  const people: PersonItem[] = [];

  for (const row of rows) {
    if (row.id.startsWith('nm')) {
      people.push({
        id: `imdb-person:${row.id}`,
        source: 'imdb',
        rawId: row.id,
        name: row.l,
        imageUrl: row.i?.imageUrl || '',
        knownFor: row.s || 'Film & Television',
        url: `https://www.imdb.com/name/${row.id}/`,
      });
    } else if (row.id.startsWith('tt')) {
      const isTv = row.qid === 'tvSeries' || row.qid === 'tvMiniSeries';
      const poster = row.i?.imageUrl || '';
      const rankScore = row.rank ? Math.max(6.4, Math.min(9.2, 9.1 - Math.log10(Math.max(1, row.rank)) * 0.45)) : 7.5;
      media.push({
        id: `imdb:${row.id}`,
        source: 'imdb',
        rawId: row.id,
        type: isTv ? 'tv' : 'movie',
        title: row.l,
        overview: row.s ? `Starring ${row.s}. Released ${row.y || 'in cinema'}.` : `${row.l} (${row.y || 'Feature'}).`,
        posterUrl: poster,
        backdropUrl: poster,
        externalUrl: `https://www.imdb.com/title/${row.id}/`,
        releaseDate: row.y ? String(row.y) : '',
        year: row.y || null,
        rating: Number(rankScore.toFixed(1)),
        genres: [isTv ? 'TV Series' : 'Feature Film'],
        castNames: row.s,
        rank: row.rank,
      });
    }
  }

  return { media, people };
}

// ---------- RWANDA AGASOBANUYI & ABASOBANUZI DIRECTORY ----------
const ABASOBANUZI_RWANDA: Umusobanuzi[] = [
  {
    id: 'rocky-kimomo',
    name: 'Rocky Kimomo',
    aka: 'Rocky Kirabiranya',
    studio: 'Rocky Entertainment',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Imirwano / Action', 'Urwenya / Comedy', 'Ikinamico / Drama'],
    bioKinyarwanda: 'Umusobanuzi ukunzwe cyane mu Rwanda uzwiho urwenya ruhambaye, imvugo yihariye n’umuvuduko ushimishije muri filimi z’imirwano na blockbusters.',
    catchphrase: 'Ntibyoroshye pe! Ibyo ni ibiki?',
  },
  {
    id: 'junior-giti',
    name: 'Junior Giti',
    aka: 'Bugingo Bony · The Premier',
    studio: 'Giti Empire',
    city: 'Kigali, Rwanda',
    era: 'Pioneer',
    specialty: ['Imirwano / Action', 'Saison / Series', 'Ikinamico / Drama'],
    bioKinyarwanda: 'Umwe mu batanze umusingi w’agasobanuye mu Rwanda, azwiho ijwi riremereye, gusobanura amagambo akomeye neza n’inkuru z’imirwano zishimishije.',
    catchphrase: 'Umva neza uko umugambi uteguye...',
  },
  {
    id: 'sankara',
    name: 'Sankara The Premier',
    aka: 'Sankara The Future',
    studio: 'Sankara Empire',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Imirwano / Action', 'Saison / Series', 'Urukundo / Romance'],
    bioKinyarwanda: 'Azwi cyane mu gusobanura filimi z’imirwano, iz’Abahinde (Igihinde), na za series zigezweho mu Kinyarwanda cyumvikana neza.',
    catchphrase: 'Sankara Empire irakomeje!',
  },
  {
    id: 'yanga',
    name: 'Yanga',
    aka: 'The One Yanga (Legend)',
    studio: 'Giti Classics',
    city: 'Kigali, Rwanda',
    era: 'Pioneer',
    specialty: ['Imirwano / Action', 'Ikinamico / Drama'],
    bioKinyarwanda: 'Intwari n’umwe mu basobanuzi ba mbere banditse amateka akomeye mu Rwanda kubera ubuhanga bw’inkuru n’ijwi ryubatse izina.',
    catchphrase: 'Amateka y’umwami w’inkuru mu Rwanda.',
  },
  {
    id: 'gaheza',
    name: 'Gaheza',
    aka: 'Gaheza Simba',
    studio: 'Simba Films',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Imirwano / Action', 'Ubwoba / Horror'],
    bioKinyarwanda: 'Abakunzi be bamwita umwami wa filimi z’imirwano (Action) n’iz’iterabwoba kubera uburyo yigana amajwi y’intambara n’inkuru zishyushye.',
    catchphrase: 'Aha hantu harashyushye cyane!',
  },
  {
    id: 'savimbi',
    name: 'Savimbi',
    aka: 'Savimbi Films',
    studio: 'Savimbi Studio',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Imirwano / Action', 'Ikinamico / Drama'],
    bioKinyarwanda: 'Umusobanuzi ufite umwihariko wo gukoresha imvugo isetsa ariko ikomeye muri filimi z’imirwano, intambara n’ubutasi.',
    catchphrase: 'Umuntu wanjye, reba aho bigeze!',
  },
  {
    id: 'pk',
    name: 'PK',
    aka: 'Prince Khalid',
    studio: 'PK Agasobanuye',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Ikinamico / Drama', 'Urukundo / Romance', 'Saison / Series'],
    bioKinyarwanda: 'Azwiho ubuhanga bwo gusobanura filimi z’ubuzima busanzwe, urukundo n’iz’ubucukumbuzi mu ijwi rituje kandi risobanutse.',
    catchphrase: 'Itonde wumve isomo ririmo.',
  },
  {
    id: 'dylan-kabaka',
    name: 'Dylan Kabaka',
    aka: 'Kabaka Studio',
    studio: 'Kabaka Production',
    city: 'Kigali, Rwanda',
    era: 'New Generation',
    specialty: ['Saison / Series', 'Imirwano / Action'],
    bioKinyarwanda: 'Umwe mu basobanuzi bashya bakunzwe cyane mu gusobanura za series (Saison) z’icyongereza n’iz’igikoreya.',
    catchphrase: 'Episode ikurikira iraza gutungurana!',
  },
  {
    id: 'younger',
    name: 'The Younger',
    aka: 'Younger Giti',
    studio: 'Giti Family',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Imirwano / Action', 'Urwenya / Comedy'],
    bioKinyarwanda: 'Umuvandimwe wa Junior Giti na Sankara, uzwiho ubushyuhe n’udushya twinshi muri filimi z’imirwano n’urwenya.',
    catchphrase: 'Ntucikwe n’aka gace!',
  },
  {
    id: 'mike-giti',
    name: 'Mike Giti',
    aka: 'Mike',
    studio: 'Giti Family',
    city: 'Kigali, Rwanda',
    era: 'Pioneer',
    specialty: ['Ikinamico / Drama', 'Imirwano / Action'],
    bioKinyarwanda: 'Umwe mu bakuru b’umuryango wa Giti wagize uruhare runini mu gutangiza umuco wo gusobanura filimi mu Rwanda.',
    catchphrase: 'Inkuru ya kera ariko itazima.',
  },
  {
    id: 'babu',
    name: 'Babu',
    aka: 'Babu Filimi',
    studio: 'Kigali Cinema Hall',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Urwenya / Comedy', 'Urukundo / Romance'],
    bioKinyarwanda: 'Umusobanuzi ukunzwe muri filimi z’urwenya, umuryango n’imibereho ya buri munsi mu rurimi rw’ikinyarwanda ruryoshye.',
    catchphrase: 'Urwenya rw’umwimerere!',
  },
  {
    id: 'hakim',
    name: 'Hakim',
    aka: 'Hakim Entertainment',
    studio: 'Hakim Films',
    city: 'Kigali, Rwanda',
    era: 'New Generation',
    specialty: ['Ubwoba / Horror', 'Imirwano / Action'],
    bioKinyarwanda: 'Azwiho gusobanura filimi z’ubwoba (Horror) n’iz’amayobera ku buryo ushobora kugira ngo uri mu nzu ya sinema.',
    catchphrase: 'Ntiwigere ufunga amaso!',
  },
  {
    id: 'master',
    name: 'Master',
    aka: 'Master Films',
    studio: 'Master Studio',
    city: 'Kigali, Rwanda',
    era: 'Pioneer',
    specialty: ['Imirwano / Action'],
    bioKinyarwanda: 'Inzobere mu gusobanura filimi z’Abashinwa n’imikino njyarugamba (Kung-Fu / Martial Arts) zatumye abantu bakunda agasobanuye.',
    catchphrase: 'Umukino wa kung-fu utangiriye hano!',
  },
  {
    id: 'sniper',
    name: 'Sniper',
    aka: 'Sniper Studio',
    studio: 'Sniper Films',
    city: 'Kigali, Rwanda',
    era: 'New Generation',
    specialty: ['Imirwano / Action', 'Saison / Series'],
    bioKinyarwanda: 'Umusobanuzi ukora cyane filimi z’intambara, abasirikare n’ubutasi mu Kinyarwanda cyihuta kandi gikomeye.',
    catchphrase: 'Nta kwibeshya na rimwe.',
  },
  {
    id: 'fayzo',
    name: 'Fayzo',
    aka: 'Fayzo Pro',
    studio: 'Fayzo Production',
    city: 'Kigali, Rwanda',
    era: 'New Generation',
    specialty: ['Saison / Series', 'Ubwoba / Horror'],
    bioKinyarwanda: 'Azwi cyane mu gutunganya no gusobanura za series z’amahanga n’inkuru za sci-fi zikunzwe n’urubyiruko.',
    catchphrase: 'Ibi byose bibera mu rwego rwo hejuru.',
  },
  {
    id: 'nelly',
    name: 'Nelly',
    aka: 'Nelly Dubs',
    studio: 'Kigali Dubs',
    city: 'Kigali, Rwanda',
    era: 'New Generation',
    specialty: ['Urukundo / Romance', 'Saison / Series', 'Ikinamico / Drama'],
    bioKinyarwanda: 'Umwe mu basobanuzi bakunzwe cyane mu nkuru z’urukundo, K-Drama (Igikoreya) n’ikinamico y’umuryango.',
    catchphrase: 'Urukundo nyarwo rugera kure.',
  },
  {
    id: 'gasongo',
    name: 'Gasongo',
    aka: 'Gasongo Films',
    studio: 'Gasongo Entertainment',
    city: 'Huye / Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Urwenya / Comedy', 'Imirwano / Action'],
    bioKinyarwanda: 'Umusobanuzi ukoresha imvugo y’urwenya rw’umwimerere mu gusobanura filimi z’imirwano n’udukino.',
    catchphrase: 'Iseke wowe gusa!',
  },
  {
    id: 'mufasa',
    name: 'Mufasa',
    aka: 'Mufasa Cinema',
    studio: 'Mufasa Kids & Family',
    city: 'Kigali, Rwanda',
    era: 'New Generation',
    specialty: ['Filimi z\'Abana / Animation', 'Urwenya / Comedy'],
    bioKinyarwanda: 'Umusobanuzi wibanda kuri filimi z’abana (Animation / Cartoons) n’iz’umuryango mu rurimi rwiza rworoshye kumva.',
    catchphrase: 'Abana n’abakuru mwese mwisange!',
  },
  {
    id: 'kibonke',
    name: 'Kibonke',
    aka: 'Kibonke Comedy',
    studio: 'Kibonke Studio',
    city: 'Kigali, Rwanda',
    era: 'Mainstream',
    specialty: ['Urwenya / Comedy', 'Ikinamico / Drama'],
    bioKinyarwanda: 'Azwiho gusetsa cyane muri filimi za Nollywood (Afurika) n’iz’urwenya zo mu muryango.',
    catchphrase: 'Uyu mugabo arantangaje pe!',
  },
  {
    id: 'benda',
    name: 'Benda',
    aka: 'Benda Films',
    studio: 'Benda Studio',
    city: 'Musanze / Kigali, Rwanda',
    era: 'New Generation',
    specialty: ['Imirwano / Action', 'Ikinamico / Drama'],
    bioKinyarwanda: 'Umusobanuzi w’ikizere utanga filimi z’ubugizi bwa nabi, ubutabera n’inkuru z’ubutasi mu Kinyarwanda.',
    catchphrase: 'Ukuri kujya ahagaragara.',
  },
];

function mapToKinyarwandaCategory(item: CinemaItem): string {
  const genresLower = item.genres.map((g) => g.toLowerCase()).join(' ');
  if (item.type === 'tv') return 'Saison / Series';
  if (item.type === 'anime' || genresLower.includes('anim') || genresLower.includes('kids') || genresLower.includes('family')) {
    return "Filimi z'Abana / Animation";
  }
  if (genresLower.includes('horror')) return 'Ubwoba / Horror';
  if (genresLower.includes('comedy')) return 'Urwenya / Comedy';
  if (genresLower.includes('romance')) return 'Urukundo / Romance';
  if (genresLower.includes('action') || genresLower.includes('adventure') || genresLower.includes('sci-fi') || genresLower.includes('thriller')) {
    return 'Imirwano / Action';
  }
  return 'Ikinamico / Drama';
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function buildAgasobanuyeCatalog(): Promise<CinemaItem[]> {
  const cached = getCached<CinemaItem[]>('agasobanuye:catalog');
  if (cached) return cached;

  const [moviesCatalog, tvCatalog, ghibli] = await Promise.all([
    getMoviesCatalog('us'),
    getTvMazeCatalog(),
    fetchGhibliFilms(),
  ]);

  const pool: CinemaItem[] = [];
  const maxLen = Math.max(moviesCatalog.length, Math.min(80, tvCatalog.length));
  for (let i = 0; i < maxLen; i++) {
    if (moviesCatalog[i]) pool.push(moviesCatalog[i]);
    if (i < 80 && tvCatalog[i]) pool.push(tvCatalog[i]);
  }
  pool.push(...ghibli);

  const enriched = pool.slice(0, 240).map((item) => {
    const kinyCategory = mapToKinyarwandaCategory(item);
    const matchingTranslators = ABASOBANUZI_RWANDA.filter((u) =>
      u.specialty.includes(kinyCategory)
    );
    const candidates = matchingTranslators.length > 0 ? matchingTranslators : ABASOBANUZI_RWANDA;
    const chosen = candidates[hashString(item.id) % candidates.length];

    return {
      ...item,
      kinyarwandaCategory: kinyCategory,
      umusobanuzi: {
        id: chosen.id,
        name: chosen.name,
        aka: chosen.aka,
      },
    };
  });

  return setCached('agasobanuye:catalog', enriched);
}

// ---------- EXPRESS SERVER ----------
async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // 1. Home Aggregate
  app.get('/api/cinema/home', async (_req, res) => {
    try {
      const cached = getCached<HomeCinemaResponse>('route:home');
      if (cached) return res.json(cached);

      const [usTop, tvCatalog, ghibli, people, moviesCatalog, agasobanuyeCatalog, archiveMovies] = await Promise.all([
        fetchItunesRss('https://itunes.apple.com/us/rss/topmovies/limit=80/json', 'US'),
        getTvMazeCatalog(),
        fetchGhibliFilms(),
        getPeopleCatalog(0),
        getMoviesCatalog('us'),
        buildAgasobanuyeCatalog(),
        getArchiveMoviesCatalog(),
      ]);

      const trending = usTop.slice(0, 24);
      const upcoming = [...moviesCatalog]
        .filter((m) => (m.year ?? 0) >= 2025)
        .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
        .slice(0, 24);

      const topRated = [
        ...ghibli.slice(0, 8),
        ...tvCatalog.filter((t) => t.rating >= 8.3).slice(0, 10),
        ...moviesCatalog.filter((m) => m.rating >= 8.3).slice(0, 8),
      ]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 24);

      const popularTv = tvCatalog.slice(0, 24);
      const animeCinema = [
        ...ghibli,
        ...moviesCatalog.filter((m) => m.genres.some((g) => g.toLowerCase().includes('anim'))),
      ].slice(0, 24);

      // Pick hero items with wide backdrops or high-res cinema imagery + trailers
      const heroCandidates = [
        ...trending.filter((m) => Boolean(m.trailerUrl)).slice(0, 4),
        ...ghibli.filter((g) => Boolean(g.backdropUrl)).slice(0, 2),
      ];
      const hero = heroCandidates.length > 0 ? heroCandidates : trending.slice(0, 5);

      const genreSet = new Set<string>();
      [...moviesCatalog, ...tvCatalog, ...ghibli].forEach((item) => {
        item.genres.forEach((g) => genreSet.add(g));
      });

      const enrichedHomeDownloads = await Promise.all(
        archiveMovies.slice(0, 12).map(async (item) => {
          const files = await resolveArchiveDownloadFiles(item.rawId);
          return {
            ...item,
            downloadFiles: files,
            downloadUrl: files[0]?.url,
            trailerUrl: files[0]?.url,
          };
        })
      );

      const payload: HomeCinemaResponse = {
        hero,
        trending,
        topRated,
        popularTv,
        upcoming: upcoming.length > 0 ? upcoming : trending.slice(0, 18),
        animeCinema,
        downloadableMovies: enrichedHomeDownloads,
        agasobanuye: agasobanuyeCatalog.slice(0, 12),
        abasobanuzi: ABASOBANUZI_RWANDA,
        people: people.slice(0, 24),
        genres: Array.from(genreSet).sort(),
        stats: {
          trendingCount: trending.length,
          topRatedCount: topRated.length,
          upcomingCount: upcoming.length || 18,
          peopleCount: people.length,
          totalCatalogCount: moviesCatalog.length + tvCatalog.length + ghibli.length + archiveMovies.length,
        },
      };

      res.json(setCached('route:home', payload));
    } catch (err) {
      console.error('Error /api/cinema/home:', err);
      res.status(500).json({ error: 'Failed to load cinema home feed' });
    }
  });

  // 2. Discover / Filter / Paginate
  app.get('/api/cinema/discover', async (req, res) => {
    try {
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const region = String(req.query.region || 'us').toLowerCase();
      const sort = String(req.query.sort || 'trending');
      const yearFilter = String(req.query.year || 'all');
      const rawMinRating = Number(req.query.minRating);
      const minRating = Number.isFinite(rawMinRating) ? Math.max(0, rawMinRating) : 0;
      const rawPage = Number(req.query.page);
      const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) ? Math.min(48, Math.max(12, Math.floor(rawLimit))) : 24;

      const validRegion = ['us', 'gb', 'jp', 'kr', 'fr'].includes(region) ? region : 'us';

      const [moviesCatalog, tvCatalog, ghibli, archiveMovies] = await Promise.all([
        type === 'tv' ? Promise.resolve([]) : getMoviesCatalog(validRegion),
        type === 'movie' ? Promise.resolve([]) : getTvMazeCatalog(),
        type === 'tv' ? Promise.resolve([]) : fetchGhibliFilms(),
        type === 'tv' || type === 'anime' ? Promise.resolve([]) : getArchiveMoviesCatalog(),
      ]);

      let combined: CinemaItem[] = [];
      if (type === 'movie') {
        combined = [...moviesCatalog, ...archiveMovies];
      } else if (type === 'tv') {
        combined = tvCatalog;
      } else if (type === 'anime') {
        combined = [...ghibli, ...moviesCatalog.filter((m) => m.genres.some((g) => g.toLowerCase().includes('anim'))), ...tvCatalog.filter((t) => t.type === 'anime')];
      } else {
        // Interleave movies and TV nicely on default 'trending'
        const maxLen = Math.max(moviesCatalog.length, tvCatalog.length);
        for (let i = 0; i < maxLen; i++) {
          if (moviesCatalog[i]) combined.push(moviesCatalog[i]);
          if (tvCatalog[i]) combined.push(tvCatalog[i]);
        }
        combined.push(...ghibli, ...archiveMovies);
      }

      // Deduplicate by id
      const seen = new Set<string>();
      combined = combined.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      const genreSet = new Set<string>();
      combined.forEach((item) => item.genres.forEach((g) => genreSet.add(g)));

      if (genre !== 'all') {
        const gLower = genre.toLowerCase();
        combined = combined.filter((item) =>
          item.genres.some((g) => g.toLowerCase().includes(gLower))
        );
      }

      if (yearFilter !== 'all') {
        if (yearFilter === '2026') combined = combined.filter((i) => i.year === 2026);
        else if (yearFilter === '2025') combined = combined.filter((i) => i.year === 2025);
        else if (yearFilter === '2020s') combined = combined.filter((i) => (i.year ?? 0) >= 2020);
        else if (yearFilter === '2010s') combined = combined.filter((i) => (i.year ?? 0) >= 2010 && (i.year ?? 0) < 2020);
        else if (yearFilter === 'classic') combined = combined.filter((i) => (i.year ?? 9999) < 2010);
      }

      if (minRating > 0) {
        combined = combined.filter((i) => i.rating >= minRating);
      }

      if (sort === 'rating') {
        combined.sort((a, b) => b.rating - a.rating);
      } else if (sort === 'newest') {
        combined.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.rating - a.rating);
      } else if (sort === 'title') {
        combined.sort((a, b) => a.title.localeCompare(b.title));
      } else {
        // trending: preserve chart rank first, then rating
        combined.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.rating - a.rating);
      }

      const total = combined.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);
      const items = combined.slice((safePage - 1) * limit, safePage * limit);

      const response: DiscoverResponse = {
        items,
        total,
        page: safePage,
        totalPages,
        genres: Array.from(genreSet).sort(),
      };
      res.json(response);
    } catch (err) {
      console.error('Error /api/cinema/discover:', err);
      res.status(500).json({ error: 'Failed to discover cinema' });
    }
  });

  // 3. Universal Search (IMDb Suggestion + TVMaze + Cached iTunes/Ghibli)
  app.get('/api/cinema/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) {
        return res.json({ movies: [], tv: [], people: [], query: '' } satisfies SearchResponse);
      }

      const cacheKey = `search:${q.toLowerCase()}`;
      const cached = getCached<SearchResponse>(cacheKey);
      if (cached) return res.json(cached);

      const [imdbRes, tvSearch, peopleSearch, moviesCatalog, ghibli, archiveMovies] = await Promise.all([
        searchImdbSuggestions(q),
        fetchJson<Array<{ show: TvMazeShow }>>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, 7000),
        fetchJson<Array<{ person: { id: number; name: string; image?: { medium?: string; original?: string } | null; country?: { name?: string } | null; birthday?: string | null; url?: string } }>>(
          `https://api.tvmaze.com/search/people?q=${encodeURIComponent(q)}`,
          7000
        ),
        getMoviesCatalog('us'),
        fetchGhibliFilms(),
        getArchiveMoviesCatalog(),
      ]);

      const qLower = q.toLowerCase();
      const localMovies = [...moviesCatalog, ...ghibli, ...archiveMovies].filter(
        (m) =>
          m.title.toLowerCase().includes(qLower) ||
          (m.director || '').toLowerCase().includes(qLower) ||
          m.genres.some((g) => g.toLowerCase().includes(qLower))
      );

      const tvMazeShows = Array.isArray(tvSearch)
        ? tvSearch.map((entry) => normalizeTvMazeShow(entry.show)).filter((s) => Boolean(s.posterUrl))
        : [];

      const tvMazePeople: PersonItem[] = Array.isArray(peopleSearch)
        ? peopleSearch
            .filter((p) => Boolean(p.person.image?.medium || p.person.image?.original))
            .map((p) => ({
              id: `tvmaze-person:${p.person.id}`,
              source: 'tvmaze',
              rawId: String(p.person.id),
              name: p.person.name,
              imageUrl: p.person.image?.original || p.person.image?.medium || '',
              country: p.person.country?.name || undefined,
              birthday: p.person.birthday || undefined,
              knownFor: 'Actor / Creator',
              url: p.person.url,
            }))
        : [];

      // Merge & deduplicate by normalized title
      const movieMap = new Map<string, CinemaItem>();
      [...localMovies, ...imdbRes.media.filter((m) => m.type === 'movie')].forEach((m) => {
        const key = `${m.title.toLowerCase()}::${m.year || ''}`;
        if (!movieMap.has(key)) movieMap.set(key, m);
      });

      const tvMap = new Map<string, CinemaItem>();
      [...tvMazeShows, ...imdbRes.media.filter((m) => m.type === 'tv')].forEach((t) => {
        const key = t.title.toLowerCase();
        if (!tvMap.has(key)) tvMap.set(key, t);
      });

      const peopleMap = new Map<string, PersonItem>();
      [...tvMazePeople, ...imdbRes.people].forEach((p) => {
        const key = p.name.toLowerCase();
        if (!peopleMap.has(key)) peopleMap.set(key, p);
      });

      const response: SearchResponse = {
        movies: Array.from(movieMap.values()).slice(0, 24),
        tv: Array.from(tvMap.values()).slice(0, 24),
        people: Array.from(peopleMap.values()).slice(0, 24),
        query: q,
      };

      res.json(setCached(cacheKey, response, 5 * 60 * 1000));
    } catch (err) {
      console.error('Error /api/cinema/search:', err);
      res.status(500).json({ error: 'Failed to search cinema' });
    }
  });

  // 4. Item Detail
  app.get('/api/cinema/item/:id', async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const cached = getCached<CinemaDetailResponse>(`detail:${id}`);
      if (cached) return res.json(cached);

      const [moviesCatalog, tvCatalog, ghibli] = await Promise.all([
        getMoviesCatalog('us'),
        getTvMazeCatalog(),
        fetchGhibliFilms(),
      ]);

      const allPool = [...moviesCatalog, ...tvCatalog, ...ghibli];

      if (id.startsWith('itunes:')) {
        const rawId = id.replace('itunes:', '');
        interface ItunesLookup {
          results?: Array<{
            trackId: number;
            trackName: string;
            artistName: string;
            previewUrl?: string;
            artworkUrl100?: string;
            trackPrice?: number;
            trackRentalPrice?: number;
            releaseDate?: string;
            trackTimeMillis?: number;
            primaryGenreName?: string;
            contentAdvisoryRating?: string;
            longDescription?: string;
            shortDescription?: string;
            trackViewUrl?: string;
          }>;
        }
        const lookup = await fetchJson<ItunesLookup>(
          `https://itunes.apple.com/lookup?id=${encodeURIComponent(rawId)}&country=US`,
          8000
        );
        const existing = moviesCatalog.find((m) => m.id === id);
        const r = lookup?.results?.[0];

        if (!existing && !r) {
          return res.status(404).json({ error: 'Movie not found' });
        }

        const base: CinemaItem = existing || {
          id,
          source: 'itunes',
          rawId,
          type: 'movie',
          title: r?.trackName || 'Feature Film',
          overview: r?.longDescription || r?.shortDescription || '',
          posterUrl: upscaleItunesArtwork(r?.artworkUrl100 || '', '600x900bb.jpg'),
          backdropUrl: upscaleItunesArtwork(r?.artworkUrl100 || '', '1200x1200bb.jpg'),
          trailerUrl: r?.previewUrl,
          externalUrl: r?.trackViewUrl,
          releaseDate: (r?.releaseDate || '').slice(0, 10),
          year: parseYear(r?.releaseDate),
          rating: 7.9,
          genres: r?.primaryGenreName ? [r.primaryGenreName] : ['Cinema'],
          director: r?.artistName,
        };

        if (r) {
          base.overview = r.longDescription || r.shortDescription || base.overview;
          base.trailerUrl = r.previewUrl || base.trailerUrl;
          base.runtimeMinutes = r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60000) : base.runtimeMinutes;
          base.advisoryRating = r.contentAdvisoryRating || base.advisoryRating;
          base.director = r.artistName || base.director;
          if (r.trackPrice) base.price = `$${r.trackPrice.toFixed(2)}`;
        }

        // Enrich cast names via IMDb suggestion lookup by movie title
        const imdbMatch = await searchImdbSuggestions(base.title.replace(/\s*\(\d{4}\)$/, ''));
        const matchedMovie = imdbMatch.media[0];
        const castList: CastMember[] = (matchedMovie?.castNames || '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((name, i) => ({
            id: `search:${encodeURIComponent(name)}`,
            name,
            character: i === 0 ? 'Lead Cast' : 'Starring',
            imageUrl: '',
          }));

        const similar = moviesCatalog
          .filter((m) => m.id !== base.id && m.genres.some((g) => base.genres.includes(g)))
          .slice(0, 12);

        const detail: CinemaDetailResponse = {
          ...base,
          cast: castList,
          episodes: [],
          seasons: [],
          similar,
        };
        return res.json(setCached(`detail:${id}`, detail));
      }

      if (id.startsWith('tvmaze:')) {
        const rawId = id.replace('tvmaze:', '');
        const show = await fetchJson<TvMazeShow>(
          `https://api.tvmaze.com/shows/${encodeURIComponent(rawId)}?embed[]=cast&embed[]=episodes`,
          9000
        );
        if (!show) return res.status(404).json({ error: 'TV show not found' });

        const base = normalizeTvMazeShow(show);
        const cast: CastMember[] = (show._embedded?.cast || []).slice(0, 18).map((c) => ({
          id: `tvmaze-person:${c.person.id}`,
          name: c.person.name,
          character: c.character.name,
          imageUrl: c.person.image?.medium || c.person.image?.original || '',
        }));

        const episodes: EpisodeItem[] = (show._embedded?.episodes || []).map((ep) => ({
          id: ep.id,
          name: ep.name,
          season: ep.season,
          number: ep.number,
          airdate: ep.airdate,
          runtime: ep.runtime,
          summary: stripHtml(ep.summary),
          imageUrl: ep.image?.medium || ep.image?.original || '',
        }));

        const seasons = Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b);
        const similar = tvCatalog
          .filter((t) => t.id !== base.id && t.genres.some((g) => base.genres.includes(g)))
          .slice(0, 12);

        const detail: CinemaDetailResponse = {
          ...base,
          cast,
          episodes,
          seasons,
          similar,
        };
        return res.json(setCached(`detail:${id}`, detail));
      }

      if (id.startsWith('ghibli:')) {
        const item = ghibli.find((g) => g.id === id);
        if (!item) return res.status(404).json({ error: 'Film not found' });
        const similar = ghibli.filter((g) => g.id !== id).slice(0, 12);
        const detail: CinemaDetailResponse = {
          ...item,
          cast: [],
          episodes: [],
          seasons: [],
          similar,
        };
        return res.json(setCached(`detail:${id}`, detail));
      }

      if (id.startsWith('imdb:')) {
        const rawId = id.replace('imdb:', '');
        const titleHint = String(req.query.title || '').trim();
        const imdbLookup = await searchImdbSuggestions(titleHint || rawId);
        const found = imdbLookup.media.find((m) => m.id === id) || imdbLookup.media[0];
        if (!found) return res.status(404).json({ error: 'Title not found' });

        // Try to match trailer from iTunes catalog
        const cleanTitle = found.title.toLowerCase();
        const itunesMatch = moviesCatalog.find((m) => m.title.toLowerCase().includes(cleanTitle));
        const castList: CastMember[] = (found.castNames || '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((name, i) => ({
            id: `search:${encodeURIComponent(name)}`,
            name,
            character: i === 0 ? 'Lead Cast' : 'Starring',
            imageUrl: '',
          }));

        const detail: CinemaDetailResponse = {
          ...found,
          trailerUrl: itunesMatch?.trailerUrl,
          overview: itunesMatch?.overview || found.overview,
          director: itunesMatch?.director || found.director,
          cast: castList,
          episodes: [],
          seasons: [],
          similar: allPool.filter((p) => p.type === found.type && p.id !== found.id).slice(0, 12),
        };
        return res.json(setCached(`detail:${id}`, detail));
      }

      if (id.startsWith('archive:')) {
        const ident = id.replace('archive:', '');
        const archiveMovies = await getArchiveMoviesCatalog();
        const found = archiveMovies.find((m) => m.id === id);
        const downloadFiles = await resolveArchiveDownloadFiles(ident);
        const primaryMp4 = downloadFiles[0]?.url;

        const base: CinemaItem = found || {
          id,
          source: 'archive',
          rawId: ident,
          type: 'movie',
          title: String(req.query.title || ident),
          overview: 'Public domain feature film available to stream and download.',
          posterUrl: `https://archive.org/services/img/${encodeURIComponent(ident)}`,
          backdropUrl: `https://archive.org/services/img/${encodeURIComponent(ident)}`,
          externalUrl: `https://archive.org/details/${encodeURIComponent(ident)}`,
          releaseDate: '',
          year: null,
          rating: 7.8,
          genres: ['Classics', 'Free Full Movie'],
          isFullMovie: true,
        };

        const detail: CinemaDetailResponse = {
          ...base,
          isFullMovie: true,
          trailerUrl: primaryMp4 || base.trailerUrl,
          downloadUrl: primaryMp4,
          downloadFiles,
          cast: [],
          episodes: [],
          seasons: [],
          similar: archiveMovies.filter((m) => m.id !== id).slice(0, 12),
        };
        return res.json(setCached(`detail:${id}`, detail));
      }

      res.status(404).json({ error: 'Unknown media identifier' });
    } catch (err) {
      console.error('Error /api/cinema/item/:id:', err);
      res.status(500).json({ error: 'Failed to load title details' });
    }
  });

  // 5. People Directory
  app.get('/api/cinema/people', async (req, res) => {
    try {
      const rawPage = Number(req.query.page);
      const page = Number.isFinite(rawPage) ? Math.max(0, Math.floor(rawPage)) : 0;
      const people = await getPeopleCatalog(page);
      res.json({ items: people, page });
    } catch (err) {
      console.error('Error /api/cinema/people:', err);
      res.status(500).json({ error: 'Failed to load people' });
    }
  });

  // 6. Person Detail
  app.get('/api/cinema/person/:id', async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id);
      const cached = getCached<PersonDetailResponse>(`person:${id}`);
      if (cached) return res.json(cached);

      if (id.startsWith('tvmaze-person:')) {
        const rawId = id.replace('tvmaze-person:', '');
        interface TvMazePersonFull {
          id: number;
          name: string;
          url?: string;
          country?: { name?: string } | null;
          birthday?: string | null;
          gender?: string | null;
          image?: { medium?: string; original?: string } | null;
          _embedded?: {
            castcredits?: Array<{
              _links?: {
                show?: { href: string };
                character?: { href: string; name?: string };
              };
            }>;
          };
        }
        const person = await fetchJson<TvMazePersonFull>(
          `https://api.tvmaze.com/people/${encodeURIComponent(rawId)}?embed=castcredits`,
          8000
        );
        if (!person) return res.status(404).json({ error: 'Person not found' });

        const creditRefs = (person._embedded?.castcredits || []).slice(0, 12);
        const creditData = await Promise.all(
          creditRefs.map(async (c) => {
            const showUrl = c._links?.show?.href;
            const charUrl = c._links?.character?.href;
            const [show, charObj] = await Promise.all([
              showUrl ? fetchJson<TvMazeShow>(showUrl, 6000) : Promise.resolve(null),
              charUrl ? fetchJson<{ name?: string }>(charUrl, 6000) : Promise.resolve(null),
            ]);
            if (!show) return null;
            return {
              character: charObj?.name || 'Cast Member',
              media: normalizeTvMazeShow(show),
            };
          })
        );

        const detail: PersonDetailResponse = {
          id,
          source: 'tvmaze',
          rawId,
          name: person.name,
          imageUrl: person.image?.original || person.image?.medium || '',
          country: person.country?.name || undefined,
          birthday: person.birthday || undefined,
          gender: person.gender || undefined,
          knownFor: 'Actor / Cast Member',
          url: person.url,
          credits: creditData.filter((x): x is { character: string; media: CinemaItem } => Boolean(x)),
        };
        return res.json(setCached(`person:${id}`, detail));
      }

      // IMDb or search-based person fallback
      const rawName = String(req.query.name || id.replace('imdb-person:', '').replace('search:', ''));
      const imdbRes = await searchImdbSuggestions(rawName);
      const foundPerson = imdbRes.people[0] || {
        id,
        source: 'imdb' as const,
        rawId: id,
        name: rawName,
        imageUrl: '',
        knownFor: 'Film & Television',
      };

      const detail: PersonDetailResponse = {
        ...foundPerson,
        credits: imdbRes.media.slice(0, 8).map((m) => ({
          character: 'Featured Credit',
          media: m,
        })),
      };
      return res.json(setCached(`person:${id}`, detail));
    } catch (err) {
      console.error('Error /api/cinema/person/:id:', err);
      res.status(500).json({ error: 'Failed to load person details' });
    }
  });

  // 7. Trailers Hub (Expanded across US, GB, JP catalogs)
  app.get('/api/cinema/trailers', async (_req, res) => {
    try {
      const cached = getCached<{ items: CinemaItem[] }>('route:trailers');
      if (cached) return res.json(cached);

      const [us, gb, jp] = await Promise.all([
        getMoviesCatalog('us'),
        getMoviesCatalog('gb'),
        getMoviesCatalog('jp'),
      ]);
      const seen = new Set<string>();
      const withTrailers: CinemaItem[] = [];
      for (const m of [...us, ...gb, ...jp]) {
        if (!m.trailerUrl) continue;
        const key = m.title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        withTrailers.push(m);
      }
      res.json(setCached('route:trailers', { items: withTrailers.slice(0, 140) }));
    } catch (err) {
      console.error('Error /api/cinema/trailers:', err);
      res.status(500).json({ error: 'Failed to load trailers' });
    }
  });

  // 7b. Downloads Hub (Full-Length Public Domain Movies + Downloadable Trailers)
  app.get('/api/cinema/downloads', async (_req, res) => {
    try {
      const cached = getCached<DownloadsResponse>('route:downloads');
      if (cached) return res.json(cached);

      const [archiveMovies, usMovies, gbMovies] = await Promise.all([
        getArchiveMoviesCatalog(),
        getMoviesCatalog('us'),
        getMoviesCatalog('gb'),
      ]);

      // Resolve primary MP4 links for top 18 Archive films in parallel so 1-click download works immediately
      const enrichedFull = await Promise.all(
        archiveMovies.slice(0, 36).map(async (item, idx) => {
          if (idx >= 18) return item;
          const files = await resolveArchiveDownloadFiles(item.rawId);
          return {
            ...item,
            downloadFiles: files,
            downloadUrl: files[0]?.url,
            trailerUrl: files[0]?.url,
          };
        })
      );

      const seen = new Set<string>();
      const trailers: CinemaItem[] = [];
      for (const m of [...usMovies, ...gbMovies]) {
        if (!m.trailerUrl) continue;
        const key = m.title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        trailers.push({ ...m, downloadUrl: m.trailerUrl });
      }

      const payload: DownloadsResponse = {
        fullMovies: enrichedFull,
        trailers: trailers.slice(0, 120),
        totalFullMovies: enrichedFull.length,
        totalTrailers: Math.min(120, trailers.length),
      };
      res.json(setCached('route:downloads', payload));
    } catch (err) {
      console.error('Error /api/cinema/downloads:', err);
      res.status(500).json({ error: 'Failed to load downloadable cinema' });
    }
  });

  // 7c. Safe Media Download Proxy (Forces attachment download across external CDNs)
  app.get('/api/cinema/download', async (req, res) => {
    try {
      const rawUrl = String(req.query.url || '').trim();
      const requestedName = String(req.query.filename || 'cineverse-media').trim();
      if (!rawUrl) {
        return res.status(400).json({ error: 'Missing download url' });
      }

      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }

      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return res.status(400).json({ error: 'Unsupported protocol' });
      }

      const host = parsed.hostname.toLowerCase();
      const allowedHost =
        host === 'archive.org' ||
        host.endsWith('.archive.org') ||
        host === 'video-ssl.itunes.apple.com' ||
        host.endsWith('.mzstatic.com') ||
        host === 'static.tvmaze.com' ||
        host === 'image.tmdb.org' ||
        host === 'm.media-amazon.com';

      if (!allowedHost) {
        return res.status(403).json({ error: 'Host not permitted for media download' });
      }

      const upstream = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'CineVerse/1.0' },
        redirect: 'follow',
      });

      if (!upstream.ok || !upstream.body) {
        return res.status(502).json({ error: 'Upstream file unavailable' });
      }

      const safeBase = requestedName.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'cineverse-media';
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const contentLength = upstream.headers.get('content-length');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeBase}"`);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeStream = Readable.fromWeb(upstream.body as any);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      nodeStream.pipe(res);
    } catch (err) {
      console.error('Error /api/cinema/download:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download media file' });
      }
    }
  });

  // 8. Release Calendar
  app.get('/api/cinema/calendar', async (_req, res) => {
    try {
      const cached = getCached<CalendarResponse>('route:calendar');
      if (cached) return res.json(cached);

      interface TvMazeScheduleItem {
        id: number;
        name: string;
        season: number;
        number: number;
        airdate: string;
        airtime: string;
        show: TvMazeShow;
      }

      const [schedule, moviesCatalog] = await Promise.all([
        fetchJson<TvMazeScheduleItem[]>('https://api.tvmaze.com/schedule?country=US', 8000),
        getMoviesCatalog('us'),
      ]);

      const airingToday = (Array.isArray(schedule) ? schedule : [])
        .filter((item) => Boolean(item.show?.image?.medium))
        .slice(0, 24)
        .map((item) => ({
          airtime: item.airtime || '20:00',
          airdate: item.airdate || '',
          episodeName: item.name,
          season: item.season || 1,
          number: item.number || 1,
          show: normalizeTvMazeShow(item.show),
        }));

      const recentMovies = [...moviesCatalog]
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.rank ?? 999) - (b.rank ?? 999))
        .slice(0, 24);

      res.json(setCached('route:calendar', { airingToday, recentMovies }));
    } catch (err) {
      console.error('Error /api/cinema/calendar:', err);
      res.status(500).json({ error: 'Failed to load release calendar' });
    }
  });

  // 9. Agasobanuye in Kinyarwanda & Abasobanuzi bose bo mu Rwanda
  app.get('/api/cinema/agasobanuye', async (req, res) => {
    try {
      const translator = String(req.query.translator || 'all');
      const category = String(req.query.category || 'all');
      const q = String(req.query.q || '').trim().toLowerCase();

      const allItems = await buildAgasobanuyeCatalog();
      const categories = Array.from(
        new Set(allItems.map((i) => i.kinyarwandaCategory).filter((c): c is string => Boolean(c)))
      ).sort();

      let filtered = allItems;
      if (translator !== 'all') {
        filtered = filtered.filter((item) => item.umusobanuzi?.id === translator);
      }
      if (category !== 'all') {
        filtered = filtered.filter((item) => item.kinyarwandaCategory === category);
      }
      if (q) {
        filtered = filtered.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            (item.umusobanuzi?.name || '').toLowerCase().includes(q) ||
            (item.umusobanuzi?.aka || '').toLowerCase().includes(q) ||
            (item.kinyarwandaCategory || '').toLowerCase().includes(q)
        );
      }

      const payload: AgasobanuyeResponse = {
        items: filtered,
        abasobanuzi: ABASOBANUZI_RWANDA,
        categories,
        total: filtered.length,
      };
      res.json(payload);
    } catch (err) {
      console.error('Error /api/cinema/agasobanuye:', err);
      res.status(500).json({ error: 'Failed to load Agasobanuye catalog' });
    }
  });

  // Vite middleware in dev; static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineVerse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
