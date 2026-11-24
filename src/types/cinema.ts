export type MediaType = 'movie' | 'tv' | 'anime';

export type CinemaSource = 'itunes' | 'tvmaze' | 'ghibli' | 'imdb';

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

export interface HomeCinemaResponse {
  hero: CinemaItem[];
  trending: CinemaItem[];
  topRated: CinemaItem[];
  popularTv: CinemaItem[];
  upcoming: CinemaItem[];
  animeCinema: CinemaItem[];
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
