import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

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
  uniqueSeerrMedia,
} from "@/backend/seerr/browse";
import {
  SeerrDetails,
  SeerrMedia,
  SeerrPage,
  SeerrUser,
} from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";
import { WideContainer } from "@/components/layout/WideContainer";
import { MediaCard, MediaCardSkeleton } from "@/components/media/MediaCard";
import { Flare } from "@/components/utils/Flare";
import { useFeaturedSlideTransition } from "@/hooks/useFeaturedSlideTransition";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { PageTitle } from "@/pages/parts/util/PageTitle";
import { usePersonalRecommendations } from "@/pages/taste/usePersonalRecommendations";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";

import { CarouselNavButtons } from "./components/CarouselNavButtons";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { SeerrCardMenu } from "./SeerrCardMenu";
import { SeerrDetailsModal } from "./SeerrDetailsModal";
import { SeerrRandomButton } from "./SeerrRandomButton";
import { SeerrSetup } from "./SeerrSetup";

function SeerrFeatured({
  media,
  onShowDetails,
  onRequest,
  category,
  onRandomError,
}: {
  media: SeerrMedia[];
  onShowDetails: (item: SeerrMedia) => void;
  onRequest: (item: SeerrMedia) => void;
  category: "movie" | "tv";
  onRandomError: (message: string) => void;
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
          <div className="w-full">
            <h1 className="max-w-3xl text-4xl md:text-6xl font-bold text-white mb-4">
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
            <p className="max-w-3xl text-lg text-white mb-6 line-clamp-3 md:line-clamp-4">
              {current.overview}
            </p>
            <div className="flex gap-3 sm:gap-4 items-center">
              <Button
                theme="secondary"
                className="flex-1 sm:flex-none text-base"
                onClick={() => onRequest(current)}
              >
                <Icon icon={Icons.PLUS} />
                Request
              </Button>
              <Button
                theme="secondary"
                className="flex-1 sm:flex-none text-base"
                onClick={() => onShowDetails(current)}
              >
                <Icon icon={Icons.CIRCLE_QUESTION} />
                More info
              </Button>
              <div className="lg:ml-auto">
                <SeerrRandomButton
                  type={category}
                  onSelect={onShowDetails}
                  onError={onRandomError}
                />
              </div>
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

function SeerrRecommendationRow({
  title,
  description,
  items,
  onSelect,
}: {
  title: string;
  description?: string;
  items: SeerrMedia[];
  onSelect: (item: SeerrMedia) => void;
}) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  if (!items.length) return null;
  return (
    <section className="mb-8" aria-label={title}>
      <div className="flex flex-col ml-2 md:ml-8 pl-2 lg:pl-[68px]">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-type-secondary">{description}</p>
        ) : null}
      </div>
      <div className="relative overflow-hidden carousel-container md:pb-4">
        <div
          className="grid grid-flow-col auto-cols-max gap-4 overflow-x-auto scrollbar-none md:px-8"
          ref={(element) => {
            refs.current[title] = element;
          }}
        >
          <div className="lg:w-12" />
          {items.map((item) => (
            <div
              key={`${item.mediaType}:${item.id}`}
              className="mt-4 p-2 w-[10rem] md:w-[11.5rem]"
            >
              <SeerrCard media={item} onShowDetails={onSelect} />
            </div>
          ))}
          <div className="lg:w-12" />
        </div>
        <div className="hidden md:block">
          <CarouselNavButtons categorySlug={title} carouselRefs={refs} />
        </div>
      </div>
    </section>
  );
}

function SeerrCarousel({
  title,
  endpoint,
  onShowDetails,
  onUnauthorized,
  refresh,
  expanded = false,
  onMore,
}: {
  title: string;
  endpoint: string;
  onShowDetails: (item: SeerrMedia) => void;
  onUnauthorized: () => void;
  refresh: number;
  expanded?: boolean;
  onMore?: (title: string, endpoint: string) => void;
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
  const [active, setActive] = useState(expanded);
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
    const force =
      refresh !== lastRead.current.refresh || retry !== lastRead.current.retry;
    const read = getCachedSeerrPage(endpoint, controller.signal, force);
    read
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
      <div className="flex flex-col ml-2 md:ml-8 mt-2 pl-2 lg:pl-[68px]">
        <h2 className="text-2xl cursor-default font-bold text-white md:text-2xl pl-0 text-balance">
          {title}
        </h2>
        {!expanded && Boolean(page?.results.length) && onMore ? (
          <button
            type="button"
            onClick={() => onMore(title, endpoint)}
            className="tabbable flex w-fit items-center gap-1 text-sm text-type-secondary hover:text-white"
          >
            View more
            <Icon icon={Icons.ARROW_RIGHT} />
          </button>
        ) : null}
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
          className={
            expanded
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 px-2 md:px-8"
              : "grid grid-flow-col auto-cols-max gap-4 pt-0 overflow-x-scroll scrollbar-none rounded-xl overflow-y-hidden md:pl-8 md:pr-8"
          }
          ref={(element) => {
            carouselRefs.current[endpoint] = element;
          }}
        >
          {!expanded ? <div className="lg:w-12" /> : null}
          {page?.results.map((item) => (
            <div
              key={`${item.mediaType}-${item.id}`}
              className={`relative mt-4 group cursor-pointer user-select-none rounded-xl p-2 bg-transparent transition-colors duration-300 ${expanded ? "min-w-0" : "w-[10rem] md:w-[11.5rem]"} h-auto`}
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
          {!expanded && page && page.page < page.totalPages && onMore ? (
            <div className="relative mt-4 rounded-xl p-2 w-[10rem] md:w-[11.5rem]">
              <button
                type="button"
                onClick={() => onMore(title, endpoint)}
                className="tabbable block w-full"
              >
                <Flare.Base className="group -m-[0.705em] rounded-xl bg-background-main transition-all duration-300 hover:scale-95 hover:bg-mediaCard-hoverBackground">
                  <Flare.Light
                    flareSize={300}
                    cssColorVar="--colors-mediaCard-hoverAccent"
                    backgroundClass="bg-mediaCard-hoverBackground duration-100"
                    className="rounded-xl bg-background-main group-hover:opacity-100"
                  />
                  <Flare.Child className="pointer-events-auto relative p-[0.4em]">
                    <div className="relative w-full pb-[150%]">
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Icon
                          icon={Icons.ARROW_RIGHT}
                          className="text-4xl mb-2"
                        />
                        <span className="text-sm">View more</span>
                      </div>
                    </div>
                  </Flare.Child>
                </Flare.Base>
              </button>
            </div>
          ) : null}
          {!expanded ? <div className="lg:w-12" /> : null}
        </div>
        {!expanded && page?.results.length ? (
          <div className="hidden md:block">
            <CarouselNavButtons
              categorySlug={endpoint}
              carouselRefs={carouselRefs}
            />
          </div>
        ) : null}
      </div>
      {expanded && page && page.page < page.totalPages ? (
        <div className="flex justify-center mt-8">
          <Button theme="secondary" loading={loading} onClick={loadMore}>
            Load more
          </Button>
        </div>
      ) : null}
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
  const location = useLocation();
  const query = searchParams.get("q")?.trim() || "";
  const [user, setUser] = useState<SeerrUser>();
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [category, setCategory] = useState<"movie" | "tv">(
    searchParams.get("kind") === "tv" ? "tv" : "movie",
  );
  useEffect(() => {
    setCategory(searchParams.get("kind") === "tv" ? "tv" : "movie");
    // Old links must not leave invisible filters active after their controls are removed.
    if (
      ["lang", "region", "genre", "sort"].some((key) => searchParams.has(key))
    ) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          ["lang", "region", "genre", "sort"].forEach((key) =>
            next.delete(key),
          );
          return next;
        },
        { replace: true, state: location.state },
      );
    }
  }, [searchParams, setSearchParams, location.state]);
  const [featured, setFeatured] = useState<SeerrMedia[]>([]);
  const [selected, setSelected] = useState<SeerrMedia>();
  const [focusRequest, setFocusRequest] = useState(false);
  const showDetails = (item: SeerrMedia) => {
    setFocusRequest(false);
    setSelected(item);
  };
  const [randomError, setRandomError] = useState("");
  const feed = searchParams.get("feed");
  const expandedFeed =
    feed &&
    /^\/(?:discover\/(?:trending|movies(?:\/upcoming)?|tv(?:\/upcoming)?)|search)(?:\?|$)/.test(
      feed,
    )
      ? { endpoint: feed, title: searchParams.get("view") || "Discover" }
      : undefined;
  const openMore = (title: string, endpoint: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("view", title);
        next.set("feed", endpoint);
        return next;
      },
      { state: { discoverGrid: true } },
    );
    window.scrollTo({ top: 0 });
  };
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
    setFocusRequest(false);
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
  const [refresh, setRefresh] = useState(0);
  const [authRetry, setAuthRetry] = useState(0);
  const featuredGeneration = useRef(0);
  const changeCategory = (kind: "movie" | "tv") => {
    if (category === kind) return;
    featuredGeneration.current += 1;
    setFeatured([]);
    setCategory(kind);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (kind === "movie") next.delete("kind");
        else next.set("kind", kind);
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
    if (!user) return undefined;
    const controller = new AbortController();
    const generation = featuredGeneration.current;
    getCachedSeerrPage(
      category === "movie" ? "/discover/movies" : "/discover/tv",
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
  }, [category, user, unauthorized]);

  const recommendations = usePersonalRecommendations(
    "seerr",
    category,
    Boolean(user) && !query && !expandedFeed,
    refresh,
  );
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
          {!query && !expandedFeed && (
            <div className="!mt-[-170px]">
              <SeerrFeatured
                media={featured}
                onShowDetails={showDetails}
                onRequest={(item) => {
                  setFocusRequest(true);
                  setSelected(item);
                }}
                category={category}
                onRandomError={setRandomError}
              />
            </div>
          )}
          <div className="relative z-20 px-4 md:px-10 min-h-screen">
            {expandedFeed ? (
              <>
                <button
                  type="button"
                  className="tabbable flex items-center gap-2 text-white hover:text-type-link mb-6"
                  onClick={() => {
                    if (location.state?.discoverGrid) {
                      navigate(-1);
                      return;
                    }
                    setSearchParams(
                      (previous) => {
                        const next = new URLSearchParams(previous);
                        next.delete("feed");
                        next.delete("view");
                        return next;
                      },
                      { replace: true },
                    );
                  }}
                >
                  <Icon icon={Icons.ARROW_LEFT} />
                  Back
                </button>
                <SeerrCarousel
                  key={expandedFeed.endpoint}
                  title={expandedFeed.title}
                  endpoint={expandedFeed.endpoint}
                  expanded
                  onShowDetails={showDetails}
                  onUnauthorized={unauthorized}
                  refresh={refresh}
                />
              </>
            ) : (
              <>
                {randomError ? (
                  <p role="alert" className="pb-4 text-center">
                    {randomError}
                  </p>
                ) : null}
                {query ? (
                  <WideContainer ultraWide classNames="!px-0">
                    <SeerrCarousel
                      key={query}
                      title={`Results for “${query}”`}
                      endpoint={`/search?query=${encodeURIComponent(query)}`}
                      onShowDetails={showDetails}
                      onUnauthorized={unauthorized}
                      onMore={openMore}
                      refresh={refresh}
                    />
                  </WideContainer>
                ) : (
                  <>
                    <div className="pb-4 w-full max-w-screen-xl mx-auto">
                      <div className="relative flex justify-center">
                        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4">
                          {(["movie", "tv"] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={`text-xl md:text-2xl font-bold p-2 bg-transparent text-center rounded-full cursor-pointer flex items-center transition-transform duration-200 ${category === value ? "transform scale-105 text-type-link" : "text-type-secondary"}`}
                              onClick={() => changeCategory(value)}
                            >
                              {value === "movie" ? "Movies" : "TV shows"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {recommendations.hasSignals ? (
                      <WideContainer ultraWide classNames="!px-0">
                        <SeerrRecommendationRow
                          title="For You"
                          items={recommendations.ranked
                            .slice(0, 20)
                            .map((entry) => entry.candidate.item)}
                          onSelect={showDetails}
                        />
                      </WideContainer>
                    ) : null}
                    <WideContainer ultraWide classNames="!px-0">
                      <SeerrCarousel
                        title="Trending"
                        endpoint="/discover/trending"
                        onShowDetails={showDetails}
                        onUnauthorized={unauthorized}
                        onMore={openMore}
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
                        onShowDetails={showDetails}
                        onUnauthorized={unauthorized}
                        onMore={openMore}
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
                        onShowDetails={showDetails}
                        onUnauthorized={unauthorized}
                        onMore={openMore}
                        refresh={refresh}
                      />
                    </WideContainer>
                  </>
                )}
              </>
            )}
            <ScrollToTopButton />
          </div>
          <SeerrDetailsModal
            media={selected}
            focusRequest={focusRequest}
            user={user}
            onClose={closeDetails}
            onRequested={requested}
            onSelectMedia={showDetails}
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
