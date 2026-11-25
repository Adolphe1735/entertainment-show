import {
  Bookmark,
  ChevronDown,
  Film,
  Menu,
  Moon,
  Search,
  Sun,
  User,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { LocalUser } from '../types/cinema';

export type NavTab =
  | 'home'
  | 'discover'
  | 'movies'
  | 'tv'
  | 'agasobanuye'
  | 'downloads'
  | 'people'
  | 'genres'
  | 'trending'
  | 'trailers'
  | 'boxoffice'
  | 'compare'
  | 'calendar'
  | 'watchlist'
  | 'search';

interface HeaderProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  searchQuery: string;
  onSearchSubmit: (q: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  user: LocalUser | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  watchlistCount: number;
}

const PRIMARY_NAV: Array<{ id: NavTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'discover', label: 'Discover' },
  { id: 'movies', label: 'Movies' },
  { id: 'tv', label: 'TV Shows' },
  { id: 'agasobanuye', label: 'Agasobanuye' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'people', label: 'People' },
  { id: 'genres', label: 'Genres' },
];

const MORE_NAV: Array<{ id: NavTab; label: string }> = [
  { id: 'trending', label: 'Trending' },
  { id: 'trailers', label: 'Trailers' },
  { id: 'boxoffice', label: 'Box Office' },
  { id: 'compare', label: 'Compare Movies' },
  { id: 'calendar', label: 'Release Calendar' },
  { id: 'watchlist', label: 'My Watchlist' },
];

export function Header({
  activeTab,
  onNavigate,
  searchQuery,
  onSearchSubmit,
  theme,
  onToggleTheme,
  user,
  onOpenAuth,
  onSignOut,
  watchlistCount,
}: HeaderProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSearchSubmit(inputValue.trim());
    setMobileSearchOpen(false);
  };

  const handleTabClick = (tab: NavTab) => {
    onNavigate(tab);
    setMoreOpen(false);
    setMobileMenuOpen(false);
  };

  const isMoreActive = MORE_NAV.some((m) => m.id === activeTab);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-md transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          {/* Brand */}
          <button
            type="button"
            onClick={() => handleTabClick('home')}
            className="flex items-center gap-2 shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
            aria-label="CineVerse home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <Film className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight text-foreground hidden sm:inline">
              Cine<span className="text-primary">Verse</span>
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 ml-2 flex-1 min-w-0" aria-label="Main navigation">
            {PRIMARY_NAV.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-foreground bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isMoreActive
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                More
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 w-52 rounded-lg border border-border bg-popover p-1.5 shadow-xl z-50"
                >
                  {MORE_NAV.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleTabClick(item.id)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        activeTab === item.id
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.id === 'watchlist' && watchlistCount > 0 && (
                        <span className="font-mono text-xs text-primary tabular-nums">
                          {watchlistCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Desktop Search */}
          <form onSubmit={handleSubmit} className="hidden md:flex items-center max-w-xs flex-1 lg:flex-initial lg:w-64">
            <div className="relative w-full">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search movies, TV, people..."
                aria-label="Search movies, TV shows, and people"
                className="flex h-9 w-full rounded-md border border-border bg-muted/60 pl-9 pr-3 py-1 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label="Open search"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('watchlist')}
              aria-label="Open watchlist"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bookmark className="h-4.5 w-4.5" aria-hidden="true" />
              {watchlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground tabular-nums">
                  {watchlistCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <div className="hidden sm:flex items-center gap-1.5">
              {user ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTabClick('watchlist')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap shrink-0"
                  >
                    <User className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    <span className="max-w-[96px] truncate">{user.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap shrink-0"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign in
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {mobileSearchOpen && (
          <form onSubmit={handleSubmit} className="pb-3 md:hidden">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search movies, TV shows, people..."
                className="flex h-10 w-full rounded-md border border-border bg-muted/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>
        )}

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="border-t border-border py-3 lg:hidden space-y-2" aria-label="Mobile navigation">
            <div className="grid grid-cols-2 gap-1.5">
              {[...PRIMARY_NAV, ...MORE_NAV].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Sign in / Create Account
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
