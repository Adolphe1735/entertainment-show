export type MediaType = 'movie' | 'tv' | 'anime';

export type CinemaSource = 'itunes' | 'tvmaze' | 'ghibli' | 'imdb' | 'archive';

export interface DownloadFileOption {
  label: string;
  url: string;
  sizeBytes?: number;
  format: string;
}

export interface CinemaItem {
  id: string;
  source: CinemaSource;
  rawId: string;
  type: MediaType;
  title: string;
  originalTitle?: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  trailerUrl?: string;
  downloadUrl?: string;
  isFullMovie?: boolean;
  downloadFiles?: DownloadFileOption[];
  externalUrl?: string;
  releaseDate: string;
  year: number | null;
  rating: number;
  runtimeMinutes?: number;
  genres: string[];
  director?: string;
  network?: string;
  status?: string;
  advisoryRating?: string;
  price?: string;
  country?: string;
  rank?: number;
  castNames?: string;
  addedAt?: string;
  umusobanuzi?: {
    id: string;
    name: string;
    aka: string;
  };
  kinyarwandaCategory?: string;
}

export interface PersonItem {
  id: string;
  source: 'tvmaze' | 'imdb';
  rawId: string;
  name: string;
  imageUrl: string;
  country?: string;
  birthday?: string;
  gender?: string;
  knownFor?: string;
  url?: string;
}

export interface CastMember {
  id: string;
  name: string;
  character: string;
  imageUrl: string;
}

export interface EpisodeItem {
  id: number;
  name: string;
  season: number;
  number: number;
  airdate: string;
  runtime: number;
  summary: string;
  imageUrl: string;
}

export interface CinemaDetailResponse extends CinemaItem {
  cast: CastMember[];
  episodes: EpisodeItem[];
  seasons: number[];
  similar: CinemaItem[];
}

export interface PersonDetailResponse extends PersonItem {
  credits: Array<{
    character: string;
    media: CinemaItem;
  }>;
}

export interface Umusobanuzi {
  id: string;
  name: string;
  aka: string;
  studio: string;
  city: string;
  era: 'Pioneer' | 'Mainstream' | 'New Generation';
  specialty: string[];
  bioKinyarwanda: string;
  catchphrase: string;
}

export interface AgasobanuyeResponse {
  items: CinemaItem[];
  abasobanuzi: Umusobanuzi[];
  categories: string[];
  total: number;
}

export interface DownloadsResponse {
  fullMovies: CinemaItem[];
  trailers: CinemaItem[];
  totalFullMovies: number;
  totalTrailers: number;
}

export interface DownloadHistoryEntry {
  id: string;
  mediaId: string;
  title: string;
  kind: 'Full Movie' | 'Trailer' | 'Poster' | 'Info Card';
  downloadedAt: string;
  posterUrl?: string;
}

export interface HomeCinemaResponse {
  hero: CinemaItem[];
  trending: CinemaItem[];
  topRated: CinemaItem[];
  popularTv: CinemaItem[];
  upcoming: CinemaItem[];
  animeCinema: CinemaItem[];
  downloadableMovies: CinemaItem[];
  agasobanuye: CinemaItem[];
  abasobanuzi: Umusobanuzi[];
  people: PersonItem[];
  genres: string[];
  stats: {
    trendingCount: number;
    topRatedCount: number;
    upcomingCount: number;
    peopleCount: number;
    totalCatalogCount: number;
  };
}

export interface DiscoverResponse {
  items: CinemaItem[];
  total: number;
  page: number;
  totalPages: number;
  genres: string[];
}

export interface SearchResponse {
  movies: CinemaItem[];
  tv: CinemaItem[];
  people: PersonItem[];
  query: string;
}

export interface CalendarResponse {
  airingToday: Array<{
    airtime: string;
    airdate: string;
    episodeName: string;
    season: number;
    number: number;
    show: CinemaItem;
  }>;
  recentMovies: CinemaItem[];
}

export interface UserReview {
  id: string;
  mediaId: string;
  mediaTitle: string;
  author: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface LocalUser {
  name: string;
  email: string;
  joinedAt: string;
}
