import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  SeerrError,
  getSeerrUser,
  seerrImage,
  seerrStatusLabel,
  seerrToMediaItem,
} from "@/backend/seerr/api";
import {
  cachedSeerrPage,
  getCachedSeerrPage,
  randomSeerrMedia,
  uniqueSeerrMedia,
} from "@/backend/seerr/browse";
import {
  SeerrDiscoveryFilters as DiscoveryFilters,
  defaultSeerrFilters,
  filteredSeerrPath,
  readSeerrFilters,
} from "@/backend/seerr/filters";
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
import { useFeaturedSlideTransition } from "@/hooks/useFeaturedSlideTransition";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { PageTitle } from "@/pages/parts/util/PageTitle";
import { usePersonalRecommendations } from "@/pages/taste/usePersonalRecommendations";
import { useTasteView } from "@/pages/taste/viewPreferences";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";

import { CarouselNavButtons } from "./components/CarouselNavButtons";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { SeerrCardMenu } from "./SeerrCardMenu";
import { SeerrDetailsModal } from "./SeerrDetailsModal";
import { SeerrDiscoveryFilters } from "./SeerrDiscoveryFilters";
import { SeerrSetup } from "./SeerrSetup";

function SeerrFeatured({
  media,
  onShowDetails,
}: {
  media: SeerrMedia[];
  onShowDetails: (item: SeerrMedia) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const startX = useRef<number>();
  const items = media.filter((item) => item.backdropPath).slice(0, 10);
  const {
    currentIndex: index,
    contentOpacity,
    goTo,
    move,
  } = useFeaturedSlideTransition(items.length, hovered || focused);
  const current = items[index % Math.max(items.length, 1)];

  if (!current) return <div className="h-20" />;

  return (
    <div
      className="relative w-full transition-[height] duration-300 ease-in-out motion-reduce:transition-none h-[40rem] min-h-[40rem] md:h-[100vh]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setFocused(false);
      }}
      onTouchStart={(event) => {
        startX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (startX.current !== undefined) {
          const difference = startX.current - event.changedTouches[0].clientX;
          if (Math.abs(difference) > 50) move(difference > 0 ? 1 : -1);
        }
        startX.current = undefined;
      }}
    >
      <div className="relative w-full h-full overflow-hidden">
        {items.map((item, itemIndex) => (
          <div
            key={`${item.mediaType}-${item.id}`}
            className={`absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none ${itemIndex === index % items.length ? "opacity-100" : "opacity-0"}`}
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
        onClick={() => move(-1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        aria-label="Previous slide"
      >
        <Icon icon={Icons.CHEVRON_LEFT} className="text-white w-8 h-8" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
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
            onClick={() => goTo(itemIndex)}
            aria-label={`Go to slide ${itemIndex + 1}`}
            className={`w-2.5 h-2.5 rounded-full transition-all ${itemIndex === index % items.length ? "bg-white scale-125" : "bg-white/50 hover:bg-white/75"}`}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 flex items-end pb-20 z-10 transition-opacity duration-150 motion-reduce:transition-none"
        style={{ opacity: contentOpacity }}
      >
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
        onShowDetails={() => onShowDetails(media)}
        renderContextMenu={(close) => (
          <SeerrCardMenu
            media={media}
            onShowDetails={onShowDetails}
            close={close}
          />
        )}
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
  const [page, setPage] = useState<SeerrPage | undefined>(() =>
    cachedSeerrPage(endpoint),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const lastRead = useRef({ refresh, retry: 0 });
  const generation = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!sectionRef.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "400px" },
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);
  const moreController = useRef<AbortController>();
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    generation.current += 1;
    moreController.current?.abort();
    setLoading(true);
    setError("");
    getCachedSeerrPage(
      endpoint,
      controller.signal,
      refresh !== lastRead.current.refresh || retry !== lastRead.current.retry,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setPage(value);
          lastRead.current = { refresh, retry };
        }
      })
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
    return () => {
      controller.abort();
      moreController.current?.abort();
      generation.current += 1;
    };
  }, [endpoint, onUnauthorized, refresh, retry, active]);

  const loadMore = async () => {
    if (!page || loading || page.page >= page.totalPages) return;
    setLoading(true);
    setError("");
    const currentGeneration = generation.current;
    const controller = new AbortController();
    moreController.current = controller;
    try {
      const next = await getCachedSeerrPage(
        `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page.page + 1}`,
        controller.signal,
      );
      if (controller.signal.aborted || currentGeneration !== generation.current)
        return;
      setPage({
        ...next,
        results: uniqueSeerrMedia([...page.results, ...next.results]),
      });
    } catch (reason) {
      if (controller.signal.aborted || currentGeneration !== generation.current)
        return;
      if (reason instanceof SeerrError && reason.status === 401)
        onUnauthorized();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load more titles.",
        );
    } finally {
      if (
        !controller.signal.aborted &&
        currentGeneration === generation.current
      )
        setLoading(false);
    }
  };

  return (
    <section ref={sectionRef} className="mb-8" aria-label={title}>
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

function SeerrLibraryDiscover() {
  const session = useJellyfinAuth((state) => state.session);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tasteView = useTasteView();
  const [user, setUser] = useState<SeerrUser>();
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [category, setCategory] = useState<"movie" | "tv">(
    searchParams.get("kind") === "tv" ? "tv" : "movie",
  );
  const [filters, setFilters] = useState<DiscoveryFilters>(() =>
    readSeerrFilters(searchParams),
  );
  useEffect(() => {
    const next = readSeerrFilters(searchParams);
    setFilters((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
    setCategory(searchParams.get("kind") === "tv" ? "tv" : "movie");
  }, [searchParams]);
  const filtersActive = Boolean(
    filters.language ||
      filters.region ||
      filters.genre ||
      filters.sort !== "popularity.desc",
  );
  const [filteredEndpoint, setFilteredEndpoint] = useState<string>();
  const [filterError, setFilterError] = useState("");
  useEffect(() => {
    if (!user || !filtersActive) {
      setFilteredEndpoint(undefined);
      setFilterError("");
      return undefined;
    }
    const controller = new AbortController();
    setFilteredEndpoint(undefined);
    setFilterError("");
    filteredSeerrPath(category, filters, controller.signal)
      .then((path) => {
        if (!controller.signal.aborted) setFilteredEndpoint(path);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setFilterError(
            reason instanceof Error
              ? reason.message
              : "Unable to apply discovery filters.",
          );
      });
    return () => controller.abort();
  }, [category, filters, filtersActive, user]);
  const [featured, setFeatured] = useState<SeerrMedia[]>([]);
  const [selected, setSelected] = useState<SeerrMedia>();
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState("");
  const randomController = useRef<AbortController>();
  useEffect(() => () => randomController.current?.abort(), []);
  useEffect(() => {
    const id = Number(searchParams.get("media"));
    const mediaType = searchParams.get("type");
    if (
      id > 0 &&
      Number.isInteger(id) &&
      (mediaType === "movie" || mediaType === "tv")
    )
      setSelected({ id, mediaType });
  }, [searchParams]);
  const closeDetails = () => {
    setSelected(undefined);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("media");
        next.delete("type");
        return next;
      },
      { replace: true },
    );
  };
  const pickRandom = async () => {
    if (randomLoading) return;
    const controller = new AbortController();
    randomController.current = controller;
    setRandomLoading(true);
    setRandomError("");
    try {
      const item = await randomSeerrMedia(
        category,
        controller.signal,
        Math.random,
        filtersActive ? filteredEndpoint : undefined,
      );
      if (!controller.signal.aborted) {
        if (item) setSelected(item);
        else setRandomError("Seerr has no titles to choose from.");
      }
    } catch (reason) {
      if (!controller.signal.aborted)
        setRandomError(
          reason instanceof Error
            ? reason.message
            : "Unable to choose a title.",
        );
    } finally {
      if (!controller.signal.aborted) setRandomLoading(false);
    }
  };
  const [refresh, setRefresh] = useState(0);
  const [authRetry, setAuthRetry] = useState(0);
  const featuredGeneration = useRef(0);
  const changeFilters = (value: DiscoveryFilters, kind = category) => {
    featuredGeneration.current += 1;
    setFeatured([]);
    setFilters(value);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, val] of Object.entries({
          lang: value.language,
          region: value.region,
          genre: value.genre,
          sort: value.sort === defaultSeerrFilters.sort ? "" : value.sort,
          kind: kind === "movie" ? "" : kind,
        })) {
          if (val) next.set(key, val);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
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
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (query.trim()) next.set("q", query.trim());
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, setSearchParams]);

  useEffect(() => {
    if (!user || (filtersActive && !filteredEndpoint)) return undefined;
    const controller = new AbortController();
    const generation = featuredGeneration.current;
    getCachedSeerrPage(
      filtersActive
        ? filteredEndpoint!
        : category === "movie"
          ? "/discover/movies"
          : "/discover/tv",
      controller.signal,
    )
      .then((page) => {
        if (
          !controller.signal.aborted &&
          generation === featuredGeneration.current
        )
          setFeatured(page.results);
      })
      .catch((reason) => {
        if (
          !controller.signal.aborted &&
          reason instanceof SeerrError &&
          reason.status === 401
        )
          unauthorized();
      });
    return () => controller.abort();
  }, [category, user, unauthorized, filtersActive, filteredEndpoint]);

  const recommendations = usePersonalRecommendations(
    "seerr",
    category,
    Boolean(user) && tasteView.seerr,
    refresh,
  );
  const personal = tasteView.seerr && !debouncedQuery;
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
        <div className="px-4 pb-12">
          {session ? (
            <SeerrSetup
              session={session}
              initiallyEnabled
              onComplete={setUser}
              onSkip={() => {
                useSeerrConnection.getState().setConnection(null);
                navigate("/");
              }}
            />
          ) : null}
        </div>
      ) : (
        <>
          {!debouncedQuery && (
            <div className="!mt-[-170px]">
              <SeerrFeatured
                media={
                  personal &&
                  recommendations.hasSignals &&
                  recommendations.hero.length
                    ? recommendations.hero.map((candidate) => candidate.item)
                    : featured
                }
                onShowDetails={setSelected}
              />
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
            <div className="flex flex-wrap justify-center gap-3 pb-6">
              <Button
                theme="secondary"
                onClick={() =>
                  useTasteView.setState({ seerr: !tasteView.seerr })
                }
              >
                {tasteView.seerr ? "Browse discovery" : "For you"}
              </Button>
              {tasteView.seerr ? (
                <Button theme="secondary" href="/taste">
                  My taste
                </Button>
              ) : null}
              <Button
                theme="secondary"
                loading={randomLoading}
                disabled={filtersActive && !filteredEndpoint}
                onClick={pickRandom}
              >
                Random {category === "movie" ? "movie" : "TV show"}
              </Button>
              <Button
                theme="secondary"
                href={
                  query.trim()
                    ? `/browse/${encodeURIComponent(query.trim())}`
                    : "/"
                }
              >
                Search my library
              </Button>
            </div>
            {randomError ? (
              <p role="alert" className="pb-4 text-center">
                {randomError}
              </p>
            ) : null}
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
                          onClick={() => {
                            if (category === value) return;
                            featuredGeneration.current += 1;
                            setFeatured([]);
                            setCategory(value);
                            changeFilters(
                              {
                                ...filters,
                                genre: "",
                                sort:
                                  filters.sort ===
                                    "primary_release_date.desc" ||
                                  filters.sort === "first_air_date.desc"
                                    ? value === "movie"
                                      ? "primary_release_date.desc"
                                      : "first_air_date.desc"
                                    : filters.sort,
                              },
                              value,
                            );
                          }}
                        >
                          {value === "movie" ? "Movies" : "TV shows"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {personal ? (
                  <WideContainer ultraWide classNames="!px-0">
                    {recommendations.loading ? (
                      <p role="status" className="py-8 text-center">
                        Finding recommendations…
                      </p>
                    ) : null}
                    {recommendations.error ? (
                      <div role="alert" className="py-8 text-center">
                        <p>{recommendations.error}</p>
                        <Button
                          onClick={() => setRefresh((value) => value + 1)}
                        >
                          Try again
                        </Button>
                      </div>
                    ) : null}
                    {!recommendations.loading && !recommendations.hasSignals ? (
                      <div className="py-8 text-center space-y-4">
                        <p>Rate movies and shows to personalise discovery.</p>
                        <Button href="/taste">Shape my recommendations</Button>
                      </div>
                    ) : null}
                    {recommendations.rows.map((row) => (
                      <section key={row.id} className="py-6">
                        <h2 className="text-2xl font-bold text-white">
                          {row.title}
                        </h2>
                        <p className="mt-2 mb-5 text-type-secondary text-sm">
                          {row.description}
                        </p>
                        <div className="flex gap-4 overflow-x-auto pb-4">
                          {row.items.map((candidate) => (
                            <div
                              className="w-36 md:w-44 shrink-0"
                              key={candidate.media.key}
                            >
                              <SeerrCard
                                media={candidate.item}
                                onShowDetails={setSelected}
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                    {!recommendations.loading &&
                    recommendations.hasSignals &&
                    !recommendations.rows.length ? (
                      <p className="py-8 text-center">
                        No new matching titles found. Adjust your taste
                        preferences or try again later.
                      </p>
                    ) : null}
                  </WideContainer>
                ) : (
                  <>
                    <SeerrDiscoveryFilters
                      type={category}
                      filters={filters}
                      onChange={changeFilters}
                    />
                    {filtersActive ? (
                      <WideContainer ultraWide classNames="!px-0">
                        {filterError ? (
                          <p role="alert" className="px-8 py-8">
                            {filterError}
                          </p>
                        ) : filteredEndpoint ? (
                          <SeerrCarousel
                            key={filteredEndpoint}
                            title={
                              category === "movie"
                                ? "Discover movies"
                                : "Discover TV shows"
                            }
                            endpoint={filteredEndpoint}
                            onShowDetails={setSelected}
                            onUnauthorized={unauthorized}
                            refresh={refresh}
                          />
                        ) : (
                          <div className="flex justify-center py-12">
                            <Spinner />
                          </div>
                        )}
                      </WideContainer>
                    ) : (
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
                            category === "movie"
                              ? "/discover/movies"
                              : "/discover/tv"
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
                    )}
                  </>
                )}
              </>
            )}
            <ScrollToTopButton />
          </div>
          <SeerrDetailsModal
            media={selected}
            user={user}
            onClose={closeDetails}
            onRequested={requested}
            onSelectMedia={setSelected}
          />
        </>
      )}
    </SubPageLayout>
  );
}

export function SeerrDiscover() {
  const session = useJellyfinAuth((state) => state.session);
  const connection = useSeerrConnection((state) => state.connection);
  const navigate = useNavigate();
  if (!session) return null;
  if (connection && matchesSeerrSession(connection, session))
    return (
      <SeerrLibraryDiscover key={`${connection.apiUrl}:${connection.userId}`} />
    );
  return (
    <SubPageLayout>
      <PageTitle subpage k="global.pages.discover" />
      <div className="px-4 pb-12">
        <SeerrSetup
          session={session}
          onComplete={() => undefined}
          onSkip={() => navigate("/")}
        />
      </div>
    </SubPageLayout>
  );
}
