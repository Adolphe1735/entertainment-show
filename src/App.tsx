import {
  ChevronRight,
  Clock,
  Flame,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { MediaDetailModal, PersonDetailModal, TrailerModal } from './components/DetailModal';
import {
  BoxOfficeView,
  CalendarView,
  CompareView,
  DiscoverView,
  GenresView,
  PeopleView,
  SearchResultsView,
  TrailersView,
  WatchlistView,
} from './components/ExploreViews';
import { Footer } from './components/Footer';
import { Header, type NavTab } from './components/Header';
import { HeroSpotlight } from './components/HeroSpotlight';
import { MediaCard } from './components/MediaCard';
import { MediaImage } from './components/MediaImage';
import { useCinemaStore } from './hooks/useCinemaStore';
import type { CinemaItem, HomeCinemaResponse } from './types/cinema';

function SectionRow({
  title,
  items,
  onSeeAll,
  onSelectMedia,
  onPlayTrailer,
  isInWatchlist,
  onToggleWatchlist,
  showRank = false,
}: {
  title: string;
  items: CinemaItem[];
  onSeeAll?: () => void;
  onSelectMedia: (item: CinemaItem) => void;
  onPlayTrailer: (item: CinemaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: CinemaItem) => void;
  showRank?: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:underline whitespace-nowrap shrink-0"
          >
            See all
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {items.slice(0, 12).map((item, idx) => (
          <MediaCard
            key={item.id}
            item={item}
            onSelect={onSelectMedia}
            onPlayTrailer={onPlayTrailer}
            inWatchlist={isInWatchlist(item.id)}
            onToggleWatchlist={onToggleWatchlist}
            rankIndex={showRank ? idx + 1 : undefined}
          />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const store = useCinemaStore();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Action');
  const [homeData, setHomeData] = useState<HomeCinemaResponse | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState(false);

  const [selectedMedia, setSelectedMedia] = useState<CinemaItem | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
    imageUrl?: string;
  } | null>(null);
  const [trailerItem, setTrailerItem] = useState<CinemaItem | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const loadHome = useCallback(() => {
    setHomeLoading(true);
    setHomeError(false);
    fetch('/api/cinema/home')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data: HomeCinemaResponse) => {
        setHomeData(data);
      })
      .catch(() => {
        setHomeError(true);
      })
      .finally(() => {
        setHomeLoading(false);
      });
  }, []);

  useEffect(() => {
    loadHome();
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('item');
    const sharedTitle = params.get('title') || '';
    if (sharedId) {
      fetch(`/api/cinema/item/${encodeURIComponent(sharedId)}?title=${encodeURIComponent(sharedTitle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: CinemaItem | null) => {
          if (data) setSelectedMedia(data);
        })
        .catch(() => {});
    }
  }, [loadHome]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTrailerItem(null);
        setSelectedPerson(null);
        setSelectedMedia(null);
        setAuthOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleNavigate = (tab: NavTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (q: string) => {
    setSearchQuery(q);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGenre = (genre: string) => {
    setSelectedGenre(genre);
    setActiveTab('genres');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allHomePool = homeData
    ? [...homeData.trending, ...homeData.topRated, ...homeData.popularTv]
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header
        activeTab={activeTab}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchSubmit={handleSearchSubmit}
        theme={store.theme}
        onToggleTheme={store.toggleTheme}
        user={store.user}
        onOpenAuth={() => setAuthOpen(true)}
        onSignOut={store.signOut}
        watchlistCount={store.watchlist.length}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <div className="space-y-12 pb-12">
            <HeroSpotlight
              items={homeData?.hero || []}
              onSelect={setSelectedMedia}
              onPlayTrailer={setTrailerItem}
              isInWatchlist={store.isInWatchlist}
              onToggleWatchlist={store.toggleWatchlist}
            />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 -mt-8 relative z-20">
              {/* 4-Card Quick Stats Strip matching CineVerse */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Cinema categories">
                <button
                  type="button"
                  onClick={() => handleNavigate('trending')}
                  className="card-lift text-left bg-card border border-border rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Flame className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-mono text-xl font-bold text-foreground tabular-nums">
                      {homeData ? homeData.stats.trendingCount : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">Trending now</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('boxoffice')}
                  className="card-lift text-left bg-card border border-border rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Star className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-mono text-xl font-bold text-foreground tabular-nums">
                      {homeData ? homeData.stats.topRatedCount : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">Top rated</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('calendar')}
                  className="card-lift text-left bg-card border border-border rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-mono text-xl font-bold text-foreground tabular-nums">
                      {homeData ? homeData.stats.upcomingCount : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">New &amp; upcoming</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('people')}
                  className="card-lift text-left bg-card border border-border rounded-lg p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-mono text-xl font-bold text-foreground tabular-nums">
                      {homeData ? homeData.stats.peopleCount : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">People</div>
                  </div>
                </button>
              </section>

              {homeError ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Unable to reach the live cinema feed right now.
                  </p>
                  <button
                    type="button"
                    onClick={loadHome}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry Connection
                  </button>
                </div>
              ) : homeLoading ? (
                <div className="space-y-10">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
                    >
                      {Array.from({ length: 6 }).map((_, col) => (
                        <div key={col} className="rounded-lg overflow-hidden bg-card border border-border">
                          <div className="aspect-[2/3] shimmer" />
                          <div className="p-3 space-y-2">
                            <div className="h-3 w-3/4 rounded shimmer" />
                            <div className="h-2.5 w-1/2 rounded shimmer" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : homeData ? (
                <div className="space-y-12">
                  <SectionRow
                    title="Trending Movies"
                    items={homeData.trending}
                    onSeeAll={() => handleNavigate('trending')}
                    onSelectMedia={setSelectedMedia}
                    onPlayTrailer={setTrailerItem}
                    isInWatchlist={store.isInWatchlist}
                    onToggleWatchlist={store.toggleWatchlist}
                    showRank
                  />

                  <SectionRow
                    title="Top Rated Cinema"
                    items={homeData.topRated}
                    onSeeAll={() => handleNavigate('discover')}
                    onSelectMedia={setSelectedMedia}
                    onPlayTrailer={setTrailerItem}
                    isInWatchlist={store.isInWatchlist}
                    onToggleWatchlist={store.toggleWatchlist}
                  />

                  <SectionRow
                    title="Popular TV Series"
                    items={homeData.popularTv}
                    onSeeAll={() => handleNavigate('tv')}
                    onSelectMedia={setSelectedMedia}
                    onPlayTrailer={setTrailerItem}
                    isInWatchlist={store.isInWatchlist}
                    onToggleWatchlist={store.toggleWatchlist}
                  />

                  <SectionRow
                    title="New & Upcoming Releases"
                    items={homeData.upcoming}
                    onSeeAll={() => handleNavigate('calendar')}
                    onSelectMedia={setSelectedMedia}
                    onPlayTrailer={setTrailerItem}
                    isInWatchlist={store.isInWatchlist}
                    onToggleWatchlist={store.toggleWatchlist}
                  />

                  <SectionRow
                    title="Studio Ghibli & Animated Cinema"
                    items={homeData.animeCinema}
                    onSeeAll={() => handleSelectGenre('Animation')}
                    onSelectMedia={setSelectedMedia}
                    onPlayTrailer={setTrailerItem}
                    isInWatchlist={store.isInWatchlist}
                    onToggleWatchlist={store.toggleWatchlist}
                  />

                  {/* Popular People Strip */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                        Popular People
                      </h2>
                      <button
                        type="button"
                        onClick={() => handleNavigate('people')}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:underline whitespace-nowrap shrink-0"
                      >
                        See all
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                      {homeData.people.slice(0, 6).map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() =>
                            setSelectedPerson({
                              id: person.id,
                              name: person.name,
                              imageUrl: person.imageUrl,
                            })
                          }
                          className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left card-lift"
                        >
                          <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
                            <MediaImage
                              src={person.imageUrl}
                              alt={person.name}
                              fallbackKind="person"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="p-3">
                            <div className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {person.name}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {person.country || 'Cast Member'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Quick Genre Jump Strip */}
                  <section className="space-y-3 border-t border-border pt-8">
                    <h2 className="font-display text-lg font-bold text-foreground">
                      Explore by Genre
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {homeData.genres.slice(0, 18).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleSelectGenre(g)}
                          className="rounded-md border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'discover' && (
          <DiscoverView
            title="Discover Cinema & TV"
            subtitle="Filter across 1,000+ movies, television series, and animated films from live global APIs."
            initialType="all"
            onSelectMedia={setSelectedMedia}
            onPlayTrailer={setTrailerItem}
            isInWatchlist={store.isInWatchlist}
            onToggleWatchlist={store.toggleWatchlist}
          />
        )}

        {activeTab === 'movies' && (
          <DiscoverView
            title="Movies Catalog"
            subtitle="Theatrical releases, genre charts, and international cinema with playable trailers."
            initialType="movie"
            lockType
            onSelectMedia={setSelectedMedia}
            onPlayTrailer={setTrailerItem}
            isInWatchlist={store.isInWatchlist}
            onToggleWatchlist={store.toggleWatchlist}
          />
        )}

        {activeTab === 'tv' && (
          <DiscoverView
            title="TV Shows"
            subtitle="Explore top-rated television series, full season episode guides, and cast."
            initialType="tv"
            lockType
            onSelectMedia={setSelectedMedia}
            onPlayTrailer={setTrailerItem}
            isInWatchlist={store.isInWatchlist}
            onToggleWatchlist={store.toggleWatchlist}
          />
        )}

        {activeTab === 'trending' && (
          <DiscoverView
            title="Trending Now"
            subtitle="Real-time trending movies and highest-momentum releases worldwide."
            initialType="all"
            initialSort="trending"
            onSelectMedia={setSelectedMedia}
            onPlayTrailer={setTrailerItem}
            isInWatchlist={store.isInWatchlist}
            onToggleWatchlist={store.toggleWatchlist}
          />
        )}

        {activeTab === 'people' && <PeopleView onSelectPerson={setSelectedPerson} />}

        {activeTab === 'genres' && (
          <GenresView
            activeGenre={selectedGenre}
            onChangeGenre={setSelectedGenre}
            onSelectMedia={setSelectedMedia}
            onPlayTrailer={setTrailerItem}
            isInWatchlist={store.isInWatchlist}
            onToggleWatchlist={store.toggleWatchlist}
          />
        )}

        {activeTab === 'trailers' && (
          <TrailersView onSelectMedia={setSelectedMedia} onPlayTrailer={setTrailerItem} />
        )}

        {activeTab === 'boxoffice' && (
          <BoxOfficeView onSelectMedia={setSelectedMedia} onPlayTrailer={setTrailerItem} />
        )}

        {activeTab === 'compare' && (
          <CompareView initialPool={allHomePool} onSelectMedia={setSelectedMedia} />
        )}

        {activeTab === 'calendar' && <CalendarView onSelectMedia={setSelectedMedia} />}

        {activeTab === 'watchlist' && (
          <WatchlistView
            watchlist={store.watchlist}
            favorites={store.favorites}
            reviews={store.reviews}
            onSelectMedia={setSelectedMedia}
            onPlayTrailer={setTrailerItem}
            isInWatchlist={store.isInWatchlist}
            onToggleWatchlist={store.toggleWatchlist}
          />
        )}

        {activeTab === 'search' && (
          <SearchResultsView
            query={searchQuery}
            onSelectMedia={setSelectedMedia}
            onPlayTrailer={setTrailerItem}
            onSelectPerson={setSelectedPerson}
            isInWatchlist={store.isInWatchlist}
            onToggleWatchlist={store.toggleWatchlist}
          />
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

      <MediaDetailModal
        item={selectedMedia}
        onClose={() => setSelectedMedia(null)}
        onSelectMedia={(next) => setSelectedMedia(next)}
        onSelectPerson={(p) => setSelectedPerson(p)}
        onSelectGenre={handleSelectGenre}
        isInWatchlist={store.isInWatchlist}
        onToggleWatchlist={store.toggleWatchlist}
        isFavorite={store.isFavorite}
        onToggleFavorite={store.toggleFavorite}
        reviews={store.reviews}
        onAddReview={store.addReview}
      />

      <PersonDetailModal
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        onSelectMedia={(m) => setSelectedMedia(m)}
      />

      <TrailerModal
        item={trailerItem}
        onClose={() => setTrailerItem(null)}
        onOpenDetail={(m) => setSelectedMedia(m)}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignIn={store.signIn}
      />
    </div>
  );
}
