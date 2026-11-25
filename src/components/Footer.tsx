import { Film } from 'lucide-react';
import type { NavTab } from './Header';

interface FooterProps {
  onNavigate: (tab: NavTab) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="mt-auto border-t border-border bg-card/50 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 mb-3 text-left"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                <Film className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
                Cine<span className="text-primary">Verse</span>
              </span>
            </button>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Your modern home for discovering movies and TV shows from around the world. Powered by live global cinema, television, and cast APIs with watchlists and reviews.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Cinema</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button type="button" onClick={() => onNavigate('discover')} className="hover:text-foreground transition-colors">
                  Discover
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('movies')} className="hover:text-foreground transition-colors">
                  Movies
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('tv')} className="hover:text-foreground transition-colors">
                  TV Shows
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('agasobanuye')} className="hover:text-foreground transition-colors">
                  Agasobanuye (Kinyarwanda)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('trending')} className="hover:text-foreground transition-colors">
                  Trending
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('boxoffice')} className="hover:text-foreground transition-colors">
                  Box Office
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button type="button" onClick={() => onNavigate('genres')} className="hover:text-foreground transition-colors">
                  Genres
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('trailers')} className="hover:text-foreground transition-colors">
                  Trailers
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('people')} className="hover:text-foreground transition-colors">
                  People
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('compare')} className="hover:text-foreground transition-colors">
                  Compare Movies
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('calendar')} className="hover:text-foreground transition-colors">
                  Release Calendar
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Your Library</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button type="button" onClick={() => onNavigate('downloads')} className="hover:text-foreground transition-colors">
                  Downloads Center
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('watchlist')} className="hover:text-foreground transition-colors">
                  Watchlist &amp; Favorites
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('watchlist')} className="hover:text-foreground transition-colors">
                  Community Reviews
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} CineVerse. Live catalog via iTunes Cinema, TVMaze, IMDb &amp; Studio Ghibli.</p>
          <p>Built for film &amp; television discovery.</p>
        </div>
      </div>
    </footer>
  );
}
