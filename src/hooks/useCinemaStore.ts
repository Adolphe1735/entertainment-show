import { useCallback, useEffect, useState } from 'react';
import type { CinemaItem, LocalUser, UserReview } from '../types/cinema';

const WATCHLIST_KEY = 'cineverse-watchlist-v1';
const FAVORITES_KEY = 'cineverse-favorites-v1';
const REVIEWS_KEY = 'cineverse-reviews-v1';
const USER_KEY = 'cineverse-user-v1';
const THEME_KEY = 'cineverse-theme';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useCinemaStore() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [watchlist, setWatchlist] = useState<CinemaItem[]>(() => readJson(WATCHLIST_KEY, []));
  const [favorites, setFavorites] = useState<CinemaItem[]>(() => readJson(FAVORITES_KEY, []));
  const [reviews, setReviews] = useState<UserReview[]>(() => readJson(REVIEWS_KEY, []));
  const [user, setUser] = useState<LocalUser | null>(() => readJson(USER_KEY, null));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {}
  }, [watchlist]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    } catch {}
  }, [reviews]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {}
  }, [user]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const isInWatchlist = useCallback(
    (id: string) => watchlist.some((item) => item.id === id),
    [watchlist]
  );

  const toggleWatchlist = useCallback((item: CinemaItem) => {
    setWatchlist((prev) =>
      prev.some((x) => x.id === item.id)
        ? prev.filter((x) => x.id !== item.id)
        : [{ ...item, addedAt: new Date().toISOString() }, ...prev]
    );
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.some((item) => item.id === id),
    [favorites]
  );

  const toggleFavorite = useCallback((item: CinemaItem) => {
    setFavorites((prev) =>
      prev.some((x) => x.id === item.id)
        ? prev.filter((x) => x.id !== item.id)
        : [{ ...item, addedAt: new Date().toISOString() }, ...prev]
    );
  }, []);

  const addReview = useCallback(
    (mediaId: string, mediaTitle: string, rating: number, text: string) => {
      const review: UserReview = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        mediaId,
        mediaTitle,
        author: user?.name || 'Cinema Member',
        rating,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };
      setReviews((prev) => [review, ...prev]);
      return review;
    },
    [user]
  );

  const signIn = useCallback((name: string, email: string) => {
    setUser({
      name: name.trim() || email.split('@')[0] || 'Member',
      email: email.trim(),
      joinedAt: new Date().toISOString(),
    });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
  }, []);

  return {
    theme,
    toggleTheme,
    watchlist,
    favorites,
    reviews,
    user,
    isInWatchlist,
    toggleWatchlist,
    isFavorite,
    toggleFavorite,
    addReview,
    signIn,
    signOut,
  };
}
