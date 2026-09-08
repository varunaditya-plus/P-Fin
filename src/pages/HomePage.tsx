import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";

import {
  cachedHomeSnapshot,
  getHomeFeedPage,
  getHomeGenres,
  getHomeSnapshot,
  getRandomMovie,
  searchLibrary,
  uniqueLibraryItems,
} from "@/backend/jellyfin/browse";
import {
  JellyfinItem,
  getHomeSections,
  getImageUrl,
} from "@/backend/jellyfin/client";
import { getJellyfinDetailsId } from "@/backend/jellyfin/details";
import {
  LibraryFilters,
  LibrarySortOrder,
  LibraryStatus,
  getLibraryFilters,
  getLibraryPage,
} from "@/backend/jellyfin/library";
import { getSeriesLengthPage } from "@/backend/jellyfin/seriesLength";
import { Button } from "@/components/buttons/Button";
import { WideContainer } from "@/components/layout/WideContainer";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { HomeLayoutControls } from "@/pages/jellyfin/HomeLayoutControls";
import { JellyfinDetailsModal } from "@/pages/jellyfin/JellyfinDetailsModal";
import { JellyfinFeaturedCarousel } from "@/pages/jellyfin/JellyfinFeaturedCarousel";
import { JellyfinHomeSection } from "@/pages/jellyfin/JellyfinHomeSection";
import {
  JellyfinMediaCard,
  JellyfinMediaCarousel,
} from "@/pages/jellyfin/JellyfinMediaCarousel";
import { LibraryCollections } from "@/pages/jellyfin/LibraryCollections";
import { HomeLayout } from "@/pages/layouts/HomeLayout";
import { HeroPart } from "@/pages/parts/home/HeroPart";
import { SearchLoadingPart } from "@/pages/parts/search/SearchLoadingPart";
import { useJellyfinAuth } from "@/stores/jellyfin";
import {
  LibraryBrowseSort,
  defaultLibraryBrowse,
  readBrowseSession,
  saveBrowseSession,
  useBrowsePreferences,
} from "@/stores/jellyfin/browse";
import {
  defaultHomePreferences,
  homePreferenceScope,
  orderedHomeSections,
  useHomePreferences,
} from "@/stores/jellyfin/home";
import { usePreferencesStore } from "@/stores/preferences";

type HomeSection = Awaited<ReturnType<typeof getHomeSections>>[number];

export function HomePage() {
  const [showBg, setShowBg] = useState(false);
  const session = useJellyfinAuth((state) => state.session);
  const scope = homePreferenceScope(session);
  const [restored] = useState(() =>
    readBrowseSession(scope, window.location.pathname),
  );
  const savedFilters = restored?.library
    ? useBrowsePreferences.getState().profiles[scope]?.libraries[
        restored.library
      ]
    : undefined;
  const restoreScroll = useRef(restored?.scroll);
  const sectionSort = useBrowsePreferences(
    (state) => state.profiles[scope]?.sectionSort,
  );
  const updateLibraryPreferences = useBrowsePreferences(
    (state) => state.updateLibrary,
  );
  const sortSection = useBrowsePreferences((state) => state.sortSection);
  const searchParams = useSearchQuery();
  const [search] = searchParams;
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [urlParams, setUrlParams] = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<string | null>(
    urlParams.get("item"),
  );
  const [detailsAction, setDetailsAction] = useState<
    "collection" | "playlist"
  >();
  const [snapshot] = useState(cachedHomeSnapshot);
  const [sections, setSections] = useState<HomeSection[]>(
    snapshot?.sections ?? [],
  );
  const [libraries, setLibraries] = useState<JellyfinItem[]>(
    snapshot?.libraries ?? [],
  );
  const [activeFeed, setActiveFeed] = useState<{
    id: string;
    title: string;
  } | null>(restored?.feed ?? null);
  const activeFeedSort = activeFeed ? sectionSort?.[activeFeed.id] : undefined;
  const [genres, setGenres] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState("");
  const randomController = useRef<AbortController>();
  useEffect(() => () => randomController.current?.abort(), []);
  const preferences = useHomePreferences(
    (state) => state.profiles[scope] ?? defaultHomePreferences,
  );
  const updatePreferences = useHomePreferences((state) => state.update);
  const resetPreferences = useHomePreferences((state) => state.reset);
  const orderedSections = useMemo(
    () => orderedHomeSections(sections, preferences),
    [sections, preferences],
  );
  const [activeLibrary, setActiveLibrary] = useState(restored?.library ?? "");
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>({
    Genres: [],
    Years: [],
  });
  const [sortBy, setSortBy] = useState<LibraryBrowseSort>(
    savedFilters?.sortBy ?? "SortName",
  );
  const [sortOrder, setSortOrder] = useState<LibrarySortOrder>(
    savedFilters?.sortOrder ?? "Ascending",
  );
  const [statusFilter, setStatusFilter] = useState<LibraryStatus>(
    savedFilters?.status ?? "all",
  );
  const [genreFilter, setGenreFilter] = useState(
    savedFilters?.genre ?? restored?.genre ?? "",
  );
  const [yearFilter, setYearFilter] = useState(savedFilters?.year ?? "");
  const [results, setResults] = useState<JellyfinItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [nextStartIndex, setNextStartIndex] = useState(0);
  const [loading, setLoading] = useState(!snapshot);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [resultError, setResultError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestGeneration = useRef(0);
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const sessionView = useRef({
    library: activeLibrary,
    feed: activeFeed,
    genre: genreFilter,
  });
  sessionView.current = {
    library: activeLibrary,
    feed: activeFeed,
    genre: genreFilter,
  };
  useEffect(() => {
    const path = window.location.pathname;
    let timer: ReturnType<typeof setTimeout>;
    const save = () =>
      saveBrowseSession(scope, path, {
        ...sessionView.current,
        scroll: window.scrollY,
      });
    const scrolled = () => {
      clearTimeout(timer);
      timer = setTimeout(save, 300);
    };
    window.addEventListener("scroll", scrolled, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      save();
      window.removeEventListener("scroll", scrolled);
      window.removeEventListener("pagehide", save);
    };
  }, [scope]);
  useEffect(() => {
    if (!activeLibrary) return;
    updateLibraryPreferences(scope, activeLibrary, {
      sortBy,
      sortOrder,
      status: statusFilter,
      genre: genreFilter,
      year: yearFilter,
    });
  }, [
    scope,
    activeLibrary,
    sortBy,
    sortOrder,
    statusFilter,
    genreFilter,
    yearFilter,
    updateLibraryPreferences,
  ]);
  useEffect(() => {
    if (
      restoreScroll.current === undefined ||
      loading ||
      ((activeLibrary || activeFeed) && !resultsLoaded)
    )
      return;
    const value = restoreScroll.current;
    restoreScroll.current = undefined;
    requestAnimationFrame(() => window.scrollTo(0, value));
  }, [loading, activeLibrary, activeFeed, resultsLoaded]);
  const enableFeatured = usePreferencesStore((state) => state.enableFeatured);

  useEffect(() => {
    const linkedItem = urlParams.get("item");
    if (linkedItem) setSelectedItem(linkedItem);
  }, [urlParams]);

  useEffect(() => {
    let active = true;
    setError("");
    getHomeSnapshot(revision > 0)
      .then(({ sections: homeSections, libraries: views }) => {
        if (!active) return;
        setSections(homeSections);
        setLibraries(views);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load your Jellyfin library.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision, scope]);

  useEffect(() => {
    const controller = new AbortController();
    getHomeGenres(controller.signal)
      .then((values) => {
        if (!controller.signal.aborted) setGenres(values);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [scope]);

  const currentLibrary = useMemo(
    () => libraries.find((item) => item.Id === activeLibrary),
    [libraries, activeLibrary],
  );

  useEffect(() => {
    if (!currentLibrary) {
      setLibraryFilters({ Genres: [], Years: [] });
      return undefined;
    }
    const controller = new AbortController();
    getLibraryFilters(currentLibrary, controller.signal)
      .then((filters) => {
        if (!controller.signal.aborted) setLibraryFilters(filters);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLibraryFilters({ Genres: [], Years: [] });
      });
    return () => controller.abort();
  }, [currentLibrary]);

  useEffect(() => {
    const controller = new AbortController();
    requestGeneration.current += 1;
    setLoadingMore(false);
    setResultError("");
    if (!debouncedSearch && !activeLibrary && !activeFeed) {
      setResults([]);
      setTotalResults(0);
      setNextStartIndex(0);
      setLoadingResults(false);
      return () => controller.abort();
    }
    setLoadingResults(true);
    const load = debouncedSearch
      ? searchLibrary(debouncedSearch, controller.signal).then((items) => ({
          Items: items,
          TotalRecordCount: items.length,
          FetchedCount: items.length,
        }))
      : activeFeed
        ? getHomeFeedPage(
            activeFeed.id,
            0,
            genreFilter,
            controller.signal,
            60,
            activeFeedSort,
          )
        : currentLibrary
          ? sortBy === "SeriesLength"
            ? getSeriesLengthPage(
                currentLibrary.Id,
                {
                  sortOrder,
                  status: statusFilter,
                  genre: genreFilter,
                  year: yearFilter ? Number(yearFilter) : undefined,
                },
                controller.signal,
              )
            : getLibraryPage(
                currentLibrary,
                {
                  sortBy,
                  sortOrder,
                  status: statusFilter,
                  genre: genreFilter,
                  year: yearFilter ? Number(yearFilter) : undefined,
                },
                controller.signal,
              )
          : Promise.resolve({
              Items: [] as JellyfinItem[],
              TotalRecordCount: 0,
              FetchedCount: 0,
            });
    load
      .then((data) => {
        if (controller.signal.aborted) return;
        setResults(data.Items);
        setTotalResults(data.TotalRecordCount ?? data.Items.length);
        setNextStartIndex(data.FetchedCount);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setResultError(
            reason instanceof Error
              ? reason.message
              : "Unable to load your library.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingResults(false);
          setResultsLoaded(true);
        }
      });
    return () => controller.abort();
  }, [
    debouncedSearch,
    activeLibrary,
    activeFeed,
    activeFeedSort,
    currentLibrary,
    sortBy,
    sortOrder,
    statusFilter,
    genreFilter,
    yearFilter,
    revision,
    scope,
  ]);

  const loadMore = async () => {
    if (loadingMore || loadingResults || (!currentLibrary && !activeFeed))
      return;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    setResultError("");
    try {
      const next = activeFeed
        ? await getHomeFeedPage(
            activeFeed.id,
            nextStartIndex,
            genreFilter,
            undefined,
            60,
            activeFeedSort,
          )
        : sortBy === "SeriesLength"
          ? await getSeriesLengthPage(currentLibrary!.Id, {
              startIndex: nextStartIndex,
              sortOrder,
              status: statusFilter,
              genre: genreFilter,
              year: yearFilter ? Number(yearFilter) : undefined,
            })
          : await getLibraryPage(currentLibrary!, {
              startIndex: nextStartIndex,
              sortBy,
              sortOrder,
              status: statusFilter,
              genre: genreFilter,
              year: yearFilter ? Number(yearFilter) : undefined,
            });
      if (generation !== requestGeneration.current) return;
      setResults((current) => uniqueLibraryItems([...current, ...next.Items]));
      setTotalResults(next.TotalRecordCount ?? totalResults);
      setNextStartIndex((current) => current + next.FetchedCount);
    } catch (reason: unknown) {
      if (generation === requestGeneration.current)
        setResultError(
          reason instanceof Error
            ? reason.message
            : "Unable to load more items.",
        );
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false);
    }
  };

  const featured = useMemo(() => {
    const seen = new Set<string>();
    return sections
      .flatMap((section) => section.items)
      .filter((item) => {
        if (
          seen.has(item.Id) ||
          !["Movie", "Series"].includes(item.Type) ||
          !getImageUrl(item, "Backdrop")
        )
          return false;
        seen.add(item.Id);
        return true;
      })
      .slice(0, 10);
  }, [sections]);

  const selectItem = (
    item: JellyfinItem,
    action?: "collection" | "playlist",
  ) => {
    setDetailsAction(action);
    setSelectedItem(getJellyfinDetailsId(item));
  };
  const searching = search.trim().length > 0;
  const showFeatured = enableFeatured && (loading || featured.length > 0);
  const showingGrid =
    searching || Boolean(activeLibrary) || Boolean(activeFeed);
  const hasLibraryFilters =
    statusFilter !== "all" || Boolean(genreFilter) || Boolean(yearFilter);
  const switchLibrary = (id: string) => {
    setActiveLibrary(id);
    setActiveFeed(null);
    const saved =
      useBrowsePreferences.getState().profiles[scope]?.libraries[id] ??
      defaultLibraryBrowse;
    setSortBy(saved.sortBy);
    setSortOrder(saved.sortOrder);
    setStatusFilter(saved.status);
    setGenreFilter(saved.genre);
    setYearFilter(saved.year);
    setLibraryFilters({ Genres: [], Years: [] });
  };
  const seeAll = (section: { id: string; title: string }) => {
    switchLibrary("");
    setActiveFeed(section);
  };
  const randomMovie = async () => {
    if (randomLoading) return;
    const controller = new AbortController();
    randomController.current = controller;
    setRandomLoading(true);
    setRandomError("");
    try {
      const item = await getRandomMovie(controller.signal);
      if (controller.signal.aborted) return;
      if (item) selectItem(item);
      else
        setRandomError(
          "There are no available movies in your Jellyfin library.",
        );
    } catch (reason) {
      if (!controller.signal.aborted)
        setRandomError(
          reason instanceof Error
            ? reason.message
            : "Unable to choose a movie.",
        );
    } finally {
      if (!controller.signal.aborted) setRandomLoading(false);
    }
  };
  const closeDetails = () => {
    setSelectedItem(null);
    if (urlParams.has("item")) {
      const next = new URLSearchParams(urlParams);
      next.delete("item");
      setUrlParams(next, { replace: true });
    }
  };

  return (
    <HomeLayout showBg={showBg}>
      <Helmet>
        <style type="text/css">
          {"html, body { scrollbar-gutter: stable; }"}
        </style>
        <title>P-Stream · Jellyfin</title>
      </Helmet>
      <div className="mb-2">
        {showFeatured ? (
          <JellyfinFeaturedCarousel
            items={featured}
            onSelect={selectItem}
            searching={showingGrid}
          >
            <HeroPart
              searchParams={searchParams}
              setIsSticky={setShowBg}
              isInFeatured
            />
          </JellyfinFeaturedCarousel>
        ) : (
          <HeroPart
            searchParams={searchParams}
            setIsSticky={setShowBg}
            showTitle
          />
        )}
      </div>
      {!searching && libraries.length > 0 ? (
        <div className="pb-4 w-full max-w-screen-xl mx-auto">
          <div className="relative flex justify-center">
            <div className="flex space-x-4 overflow-x-auto px-4 scrollbar-none">
              {[{ Id: "", Name: "Home" }, ...libraries].map((library) => (
                <button
                  key={library.Id}
                  type="button"
                  className={`text-xl md:text-2xl font-bold p-2 bg-transparent text-center rounded-full cursor-pointer flex items-center whitespace-nowrap transition-transform duration-200 ${activeLibrary === library.Id && !activeFeed ? "transform scale-105 text-type-link" : "text-type-secondary"}`}
                  onClick={() => switchLibrary(library.Id)}
                >
                  {library.Name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <WideContainer>
        <div className="flex flex-wrap items-center justify-center gap-3 py-4">
          <Button
            theme="secondary"
            href={`/discover${searching ? `?q=${encodeURIComponent(search.trim())}` : ""}`}
          >
            Discover & request
          </Button>
          <Button
            theme="secondary"
            loading={randomLoading}
            onClick={randomMovie}
          >
            Random movie
          </Button>
          {!searching ? (
            <>
              <Button
                theme="secondary"
                onClick={() =>
                  seeAll({ id: "recent", title: "Recently added" })
                }
              >
                Recently added
              </Button>
              <Button
                theme="secondary"
                onClick={() => seeAll({ id: "completed", title: "Completed" })}
              >
                Completed
              </Button>
            </>
          ) : null}
          {activeFeed ? (
            <Button theme="secondary" onClick={() => switchLibrary("")}>
              Back to home
            </Button>
          ) : null}
        </div>
        <LibraryCollections
          onOpen={(id) => setSelectedItem(id)}
          onChanged={() => setRevision((value) => value + 1)}
        />
        {randomError ? (
          <p role="alert" className="pb-4 text-center">
            {randomError}
          </p>
        ) : null}
        {!showingGrid ? (
          <div className="mb-6 space-y-4">
            {genres.length ? (
              <div
                className="flex flex-wrap justify-center gap-2"
                aria-label="Browse genres"
              >
                {(allGenres ? genres : genres.slice(0, 8)).map((genre) => (
                  <button
                    type="button"
                    key={genre}
                    className="rounded-full bg-buttons-cancel px-4 py-2 text-sm text-white hover:bg-buttons-cancelHover"
                    onClick={() => {
                      seeAll({ id: "all", title: genre });
                      setGenreFilter(genre);
                    }}
                  >
                    {genre}
                  </button>
                ))}
                {genres.length > 8 ? (
                  <button
                    type="button"
                    className="rounded-full px-4 py-2 text-sm text-type-link"
                    onClick={() => setAllGenres((value) => !value)}
                  >
                    {allGenres ? "Fewer genres" : "More genres"}
                  </button>
                ) : null}
              </div>
            ) : null}
            <HomeLayoutControls
              sections={orderedSections}
              preferences={preferences}
              onChange={(changes) => updatePreferences(scope, changes)}
              onReset={() => resetPreferences(scope)}
              sectionSort={sectionSort}
              onSort={(id, sort) => sortSection(scope, id, sort)}
            />
          </div>
        ) : null}
      </WideContainer>
      {error ? (
        <WideContainer>
          <div role="alert" className="py-12 text-center space-y-4">
            <p>{error}</p>
            <Button
              theme="secondary"
              onClick={() => {
                setLoading(true);
                setRevision((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </div>
        </WideContainer>
      ) : null}
      {showingGrid ? (
        <WideContainer>
          <div className="pb-12 pt-8">
            <h2 className="text-2xl font-bold text-white mb-8">
              {searching
                ? "Search your library"
                : (activeFeed?.title ??
                  libraries.find((library) => library.Id === activeLibrary)
                    ?.Name)}
            </h2>
            {!searching && currentLibrary ? (
              <div
                className="mb-8 flex flex-wrap items-end gap-3"
                aria-label="Library controls"
              >
                <label className="flex flex-col gap-2 text-sm text-type-secondary">
                  Sort by
                  <select
                    aria-label="Sort library by"
                    className="rounded-lg bg-dropdown-background px-4 py-3 text-white"
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as LibraryBrowseSort)
                    }
                  >
                    <option value="SortName">Title</option>
                    <option value="DateCreated">Date added</option>
                    <option value="ProductionYear">Release year</option>
                    <option value="CommunityRating">Rating</option>
                    {currentLibrary.CollectionType === "tvshows" ? (
                      <option value="SeriesLength">Total series length</option>
                    ) : null}
                    {currentLibrary.CollectionType !== "boxsets" &&
                    currentLibrary.CollectionType !== "tvshows" ? (
                      <option value="Runtime">Runtime</option>
                    ) : null}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-type-secondary">
                  Order
                  <select
                    aria-label="Sort order"
                    className="rounded-lg bg-dropdown-background px-4 py-3 text-white"
                    value={sortOrder}
                    onChange={(event) =>
                      setSortOrder(event.target.value as LibrarySortOrder)
                    }
                  >
                    <option value="Ascending">Ascending</option>
                    <option value="Descending">Descending</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-type-secondary">
                  Watched status
                  <select
                    aria-label="Watched status"
                    className="rounded-lg bg-dropdown-background px-4 py-3 text-white"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as LibraryStatus)
                    }
                  >
                    <option value="all">All titles</option>
                    <option value="IsUnplayed">Unplayed</option>
                    <option value="IsPlayed">Played</option>
                    <option value="IsFavorite">Favourites</option>
                    {currentLibrary.CollectionType !== "boxsets" &&
                    currentLibrary.CollectionType !== "playlists" ? (
                      <option value="IsResumable">Continue watching</option>
                    ) : null}
                  </select>
                </label>
                {libraryFilters.Genres.length > 0 ? (
                  <label className="flex flex-col gap-2 text-sm text-type-secondary">
                    Genre
                    <select
                      aria-label="Genre"
                      className="rounded-lg bg-dropdown-background px-4 py-3 text-white"
                      value={genreFilter}
                      onChange={(event) => setGenreFilter(event.target.value)}
                    >
                      <option value="">All genres</option>
                      {libraryFilters.Genres.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {libraryFilters.Years.length > 0 ? (
                  <label className="flex flex-col gap-2 text-sm text-type-secondary">
                    Year
                    <select
                      aria-label="Release year"
                      className="rounded-lg bg-dropdown-background px-4 py-3 text-white"
                      value={yearFilter}
                      onChange={(event) => setYearFilter(event.target.value)}
                    >
                      <option value="">All years</option>
                      {libraryFilters.Years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {hasLibraryFilters ? (
                  <Button
                    theme="secondary"
                    onClick={() => {
                      setStatusFilter("all");
                      setGenreFilter("");
                      setYearFilter("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>
            ) : null}
            {(loadingResults || debouncedSearch !== search.trim()) &&
            !results.length ? (
              <SearchLoadingPart />
            ) : (
              <>
                {loadingResults || debouncedSearch !== search.trim() ? (
                  <p role="status" className="mb-4 text-sm text-type-secondary">
                    Updating titles…
                  </p>
                ) : (
                  <p className="mb-4 text-sm text-type-secondary">
                    {totalResults} {searching ? "matches" : "titles"}
                  </p>
                )}
                <div
                  aria-busy={loadingResults}
                  className={
                    preferences.density === "compact"
                      ? "grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8"
                      : "grid grid-cols-2 gap-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 3xl:grid-cols-8"
                  }
                >
                  {results.map((item) => (
                    <JellyfinMediaCard
                      key={item.Id}
                      item={item}
                      onSelect={selectItem}
                      onItemChanged={() => setRevision((value) => value + 1)}
                    />
                  ))}
                </div>
                {!results.length && !resultError ? (
                  <p className="py-12 text-center">
                    {searching
                      ? "No matching content in your Jellyfin library."
                      : currentLibrary?.CollectionType === "boxsets"
                        ? "This library has no collections."
                        : currentLibrary?.CollectionType === "playlists"
                          ? "This library has no playlists."
                          : "This library has no available movies or series."}
                  </p>
                ) : null}
                {resultError ? (
                  <div role="alert" className="py-8 text-center space-y-4">
                    <p>{resultError}</p>
                    <Button
                      theme="secondary"
                      onClick={() => setRevision((value) => value + 1)}
                    >
                      Try again
                    </Button>
                  </div>
                ) : null}
                {!searching && nextStartIndex < totalResults ? (
                  <div className="flex justify-center py-8">
                    <Button
                      theme="secondary"
                      loading={loadingMore}
                      disabled={loadingResults}
                      onClick={loadMore}
                    >
                      Load more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </WideContainer>
      ) : (
        <WideContainer ultraWide classNames="!px-3 md:!px-9">
          <div className="space-y-4 pb-12">
            {loading && !sections.length ? (
              <JellyfinMediaCarousel
                id="loading-library"
                title="Your library"
                items={[]}
                loading
                onSelect={selectItem}
              />
            ) : (
              orderedSections
                .filter((section) => !preferences.hidden.includes(section.id))
                .map((section) => (
                  <JellyfinHomeSection
                    key={section.id}
                    {...section}
                    preferences={preferences}
                    sort={sectionSort?.[section.id]}
                    onSeeAll={() => seeAll(section)}
                    onSelect={selectItem}
                    onItemChanged={() => setRevision((value) => value + 1)}
                  />
                ))
            )}
            {!loading &&
            sections.length > 0 &&
            sections.every((section) =>
              preferences.hidden.includes(section.id),
            ) ? (
              <p className="py-12 text-center">
                All home sections are hidden. Use Edit layout to show them
                again.
              </p>
            ) : null}
            {!loading && !error && !sections.length ? (
              <p className="py-20 text-center">
                There are no movies or series available to your Jellyfin
                account.
              </p>
            ) : null}
          </div>
        </WideContainer>
      )}
      <JellyfinDetailsModal
        itemId={selectedItem}
        initialAction={detailsAction}
        onClose={closeDetails}
        onItemChanged={() => setRevision((value) => value + 1)}
      />
    </HomeLayout>
  );
}
