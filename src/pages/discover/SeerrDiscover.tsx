import { FormEvent, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";

import {
  SeerrError,
  authenticateSeerr,
  getSeerrPage,
  getSeerrUser,
  seerrImage,
  seerrStatusLabel,
  seerrToMediaItem,
} from "@/backend/seerr/api";
import {
  SeerrDetails,
  SeerrMedia,
  SeerrPage,
  SeerrUser,
} from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { SearchBarInput } from "@/components/form/SearchBar";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { WideContainer } from "@/components/layout/WideContainer";
import { MediaCard, MediaCardSkeleton } from "@/components/media/MediaCard";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { PageTitle } from "@/pages/parts/util/PageTitle";

import { CarouselNavButtons } from "./components/CarouselNavButtons";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { SeerrDetailsModal } from "./SeerrDetailsModal";

function SeerrSignIn({
  onSignedIn,
}: {
  onSignedIn: (user: SeerrUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await authenticateSeerr(username, password);
      const user = await getSeerrUser();
      setPassword("");
      onSignedIn(user);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not sign in to Seerr.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-4">Discover</h1>
      <p className="text-type-secondary mb-8">
        Sign in with your Jellyfin account to discover and request content
        through Seerr.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          Username
          <input
            required
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="block w-full mt-2 rounded-lg bg-dropdown-background p-4 text-white outline-none focus:ring-2 focus:ring-buttons-purple"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="block w-full mt-2 rounded-lg bg-dropdown-background p-4 text-white outline-none focus:ring-2 focus:ring-buttons-purple"
          />
        </label>
        {error && (
          <p role="alert" className="text-red-400 text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 bg-buttons-purple hover:bg-buttons-purpleHover text-white font-medium disabled:opacity-60"
        >
          {loading && <Spinner />}Sign in to Seerr
        </button>
      </form>
    </div>
  );
}

function SeerrFeatured({
  media,
  onShowDetails,
}: {
  media: SeerrMedia[];
  onShowDetails: (item: SeerrMedia) => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number>();
  const items = media.filter((item) => item.backdropPath).slice(0, 10);
  const current = items[index % Math.max(items.length, 1)];

  useEffect(() => {
    if (
      paused ||
      items.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return undefined;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % items.length),
      8000,
    );
    return () => window.clearInterval(timer);
  }, [paused, items.length]);

  if (!current) return <div className="h-20" />;

  return (
    <div
      className="relative w-full transition-[height] duration-300 ease-in-out h-[40rem] min-h-[40rem] md:h-[100vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => {
        startX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (startX.current !== undefined) {
          const difference = startX.current - event.changedTouches[0].clientX;
          if (Math.abs(difference) > 50)
            setIndex(
              (value) =>
                (value + (difference > 0 ? 1 : -1) + items.length) %
                items.length,
            );
        }
        startX.current = undefined;
      }}
    >
      <div className="relative w-full h-full overflow-hidden">
        {items.map((item, itemIndex) => (
          <div
            key={`${item.mediaType}-${item.id}`}
            className={`absolute inset-0 transition-opacity duration-1000 ${itemIndex === index % items.length ? "opacity-100" : "opacity-0"}`}
            style={{
              backgroundImage: `url(${seerrImage(item.backdropPath, "original")})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              maskImage:
                "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 700px)",
              WebkitMaskImage:
                "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 700px)",
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setIndex((value) => (value - 1 + items.length) % items.length)
        }
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        aria-label="Previous slide"
      >
        <Icon icon={Icons.CHEVRON_LEFT} className="text-white w-8 h-8" />
      </button>
      <button
        type="button"
        onClick={() => setIndex((value) => (value + 1) % items.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        aria-label="Next slide"
      >
        <Icon icon={Icons.CHEVRON_RIGHT} className="text-white w-8 h-8" />
      </button>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[19] flex gap-2">
        {items.map((item, itemIndex) => (
          <button
            key={`${item.mediaType}-${item.id}`}
            type="button"
            onClick={() => setIndex(itemIndex)}
            aria-label={`Go to slide ${itemIndex + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-all ${itemIndex === index % items.length ? "bg-white scale-125" : "bg-white/50 hover:bg-white/75"}`}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-end pb-20 z-10">
        <div className="container mx-auto px-8 lg:px-4 flex justify-between items-end w-full">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              {current.title || current.name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-white/80 mb-4">
              {!!current.voteAverage && (
                <>
                  <Icon icon={Icons.TMDB} />
                  <span>{current.voteAverage.toFixed(1)}</span>
                  <span>·</span>
                </>
              )}
              <span>{current.mediaType === "movie" ? "Movie" : "TV show"}</span>
              {(current.releaseDate || current.firstAirDate) && (
                <>
                  <span>·</span>
                  <span>
                    {new Date(
                      current.releaseDate || current.firstAirDate || "",
                    ).getFullYear()}
                  </span>
                </>
              )}
            </div>
            <p className="text-lg text-white mb-6 line-clamp-3 md:line-clamp-4">
              {current.overview}
            </p>
            <div className="flex gap-4 justify-center items-center sm:justify-start">
              <Button
                theme="secondary"
                className="w-full sm:w-auto text-base"
                onClick={() => onShowDetails(current)}
              >
                <Icon icon={Icons.CIRCLE_QUESTION} />
                More info
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeerrCard({
  media,
  onShowDetails,
}: {
  media: SeerrMedia;
  onShowDetails: (item: SeerrMedia) => void;
}) {
  return (
    <div className="relative">
      <MediaCard
        media={seerrToMediaItem(media)}
        linkable
        hideBookmark
        onShowDetails={() => onShowDetails(media)}
      />
      {media.mediaInfo && media.mediaInfo.status > 1 && (
        <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-mediaCard-badge px-2 py-1 text-[10px] text-mediaCard-badgeText">
          {seerrStatusLabel(media.mediaInfo.status)}
        </span>
      )}
    </div>
  );
}

function SeerrCarousel({
  title,
  endpoint,
  onShowDetails,
  onUnauthorized,
  refresh,
}: {
  title: string;
  endpoint: string;
  onShowDetails: (item: SeerrMedia) => void;
  onUnauthorized: () => void;
  refresh: number;
}) {
  const [page, setPage] = useState<SeerrPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getSeerrPage(endpoint, controller.signal)
      .then(setPage)
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof SeerrError && reason.status === 401)
          onUnauthorized();
        else
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this collection.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, onUnauthorized, refresh, retry]);

  const loadMore = async () => {
    if (!page || loading || page.page >= page.totalPages) return;
    setLoading(true);
    setError("");
    try {
      const next = await getSeerrPage(
        `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page.page + 1}`,
      );
      setPage({
        ...next,
        results: [
          ...page.results,
          ...next.results.filter(
            (item) =>
              !page.results.some(
                (existing) =>
                  existing.id === item.id &&
                  existing.mediaType === item.mediaType,
              ),
          ),
        ],
      });
    } catch (reason) {
      if (reason instanceof SeerrError && reason.status === 401)
        onUnauthorized();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load more titles.",
        );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-8" aria-label={title}>
      <div className="flex items-center justify-between ml-2 md:ml-8 mt-2">
        <div className="flex flex-col pl-2 lg:pl-[68px]">
          <h2 className="text-2xl cursor-default font-bold text-white md:text-2xl pl-0 text-balance">
            {title}
          </h2>
        </div>
      </div>
      {error && (
        <div className="px-8 py-4">
          <p role="alert" className="mb-3">
            {error}
          </p>
          <Button
            theme="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="relative overflow-hidden carousel-container md:pb-4">
        <div
          className="grid grid-flow-col auto-cols-max gap-4 pt-0 overflow-x-scroll scrollbar-none rounded-xl overflow-y-hidden md:pl-8 md:pr-8"
          ref={(element) => {
            carouselRefs.current[endpoint] = element;
          }}
        >
          <div className="lg:w-12" />
          {page?.results.map((item) => (
            <div
              key={`${item.mediaType}-${item.id}`}
              className="relative mt-4 group cursor-pointer user-select-none rounded-xl p-2 bg-transparent transition-colors duration-300 w-[10rem] md:w-[11.5rem] h-auto"
            >
              <SeerrCard media={item} onShowDetails={onShowDetails} />
            </div>
          ))}
          {loading &&
            !page &&
            Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="mt-4 p-2 w-[10rem] md:w-[11.5rem]">
                <MediaCardSkeleton />
              </div>
            ))}
          {page && page.page < page.totalPages && (
            <div className="flex items-center justify-center px-4 w-[10rem]">
              <Button theme="secondary" loading={loading} onClick={loadMore}>
                More
              </Button>
            </div>
          )}
          <div className="lg:w-12" />
        </div>
        {page?.results.length ? (
          <div className="hidden md:block">
            <CarouselNavButtons
              categorySlug={endpoint}
              carouselRefs={carouselRefs}
            />
          </div>
        ) : null}
      </div>
      {!loading && !error && !page?.results.length && (
        <p className="px-8 py-6 text-type-secondary">No titles found.</p>
      )}
    </section>
  );
}

export function SeerrDiscover() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<SeerrUser>();
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [category, setCategory] = useState<"movie" | "tv">("movie");
  const [featured, setFeatured] = useState<SeerrMedia[]>([]);
  const [selected, setSelected] = useState<SeerrMedia>();
  const [refresh, setRefresh] = useState(0);
  const [authRetry, setAuthRetry] = useState(0);
  const unauthorized = useRef(() => setUser(undefined)).current;

  useEffect(() => {
    let active = true;
    setAuthLoading(true);
    setAuthError("");
    getSeerrUser()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch((reason) => {
        if (
          active &&
          (!(reason instanceof SeerrError) || reason.status !== 401)
        )
          setAuthError(
            reason instanceof Error
              ? reason.message
              : "Could not connect to Seerr.",
          );
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authRetry]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setSearchParams(query.trim() ? { q: query.trim() } : {}, {
        replace: true,
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, setSearchParams]);

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    getSeerrPage(
      category === "movie" ? "/discover/movies" : "/discover/tv",
      controller.signal,
    )
      .then((page) => setFeatured(page.results))
      .catch((reason) => {
        if (
          !controller.signal.aborted &&
          reason instanceof SeerrError &&
          reason.status === 401
        )
          unauthorized();
      });
    return () => controller.abort();
  }, [category, user, unauthorized]);

  const requested = (details: SeerrDetails) => {
    setSelected(details);
    setRefresh((value) => value + 1);
  };

  return (
    <SubPageLayout>
      <PageTitle subpage k="global.pages.discover" />
      <Helmet>
        <style type="text/css">
          {"html, body { scrollbar-width: none; -ms-overflow-style: none; }"}
        </style>
      </Helmet>
      {authLoading ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : authError ? (
        <div className="mx-auto max-w-lg p-8">
          <p role="alert" className="mb-6">
            {authError}
          </p>
          <Button
            theme="purple"
            onClick={() => setAuthRetry((value) => value + 1)}
          >
            Reconnect to Seerr
          </Button>
        </div>
      ) : !user ? (
        <SeerrSignIn onSignedIn={setUser} />
      ) : (
        <>
          {!debouncedQuery && (
            <div className="!mt-[-170px]">
              <SeerrFeatured media={featured} onShowDetails={setSelected} />
            </div>
          )}
          <div className="relative z-20 px-4 md:px-10 min-h-screen">
            <div className="mx-auto max-w-xl mb-8 px-4">
              <SearchBarInput
                value={query}
                onChange={setQuery}
                onUnFocus={() => undefined}
                placeholder="Search movies and TV shows to request"
                hideTooltip
              />
            </div>
            {debouncedQuery ? (
              <WideContainer ultraWide classNames="!px-0">
                <SeerrCarousel
                  key={debouncedQuery}
                  title={`Results for “${debouncedQuery}”`}
                  endpoint={`/search?query=${encodeURIComponent(debouncedQuery)}`}
                  onShowDetails={setSelected}
                  onUnauthorized={unauthorized}
                  refresh={refresh}
                />
              </WideContainer>
            ) : (
              <>
                <div className="pb-4 w-full max-w-screen-xl mx-auto">
                  <div className="relative flex justify-center">
                    <div className="flex space-x-4">
                      {(["movie", "tv"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`text-xl md:text-2xl font-bold p-2 bg-transparent text-center rounded-full cursor-pointer flex items-center transition-transform duration-200 ${category === value ? "transform scale-105 text-type-link" : "text-type-secondary"}`}
                          onClick={() => setCategory(value)}
                        >
                          {value === "movie" ? "Movies" : "TV shows"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <WideContainer ultraWide classNames="!px-0">
                  <SeerrCarousel
                    title="Trending"
                    endpoint="/discover/trending"
                    onShowDetails={setSelected}
                    onUnauthorized={unauthorized}
                    refresh={refresh}
                  />
                  <SeerrCarousel
                    key={`popular-${category}`}
                    title={
                      category === "movie"
                        ? "Popular movies"
                        : "Popular TV shows"
                    }
                    endpoint={
                      category === "movie" ? "/discover/movies" : "/discover/tv"
                    }
                    onShowDetails={setSelected}
                    onUnauthorized={unauthorized}
                    refresh={refresh}
                  />
                  <SeerrCarousel
                    key={`upcoming-${category}`}
                    title={
                      category === "movie"
                        ? "Upcoming movies"
                        : "Upcoming TV shows"
                    }
                    endpoint={
                      category === "movie"
                        ? "/discover/movies/upcoming"
                        : "/discover/tv/upcoming"
                    }
                    onShowDetails={setSelected}
                    onUnauthorized={unauthorized}
                    refresh={refresh}
                  />
                </WideContainer>
              </>
            )}
            <ScrollToTopButton />
          </div>
          {selected && (
            <SeerrDetailsModal
              key={`${selected.mediaType}-${selected.id}`}
              media={selected}
              user={user}
              onClose={() => setSelected(undefined)}
              onRequested={requested}
            />
          )}
        </>
      )}
    </SubPageLayout>
  );
}
