import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";

import {
  JellyfinItem,
  getHomeSections,
  getImageUrl,
  getLibraries,
  getLibraryItems,
  searchItems,
} from "@/backend/jellyfin/client";
import { Button } from "@/components/buttons/Button";
import { WideContainer } from "@/components/layout/WideContainer";
import { MediaGrid } from "@/components/media/MediaGrid";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { JellyfinDetailsModal } from "@/pages/jellyfin/JellyfinDetailsModal";
import { JellyfinFeaturedCarousel } from "@/pages/jellyfin/JellyfinFeaturedCarousel";
import {
  JellyfinMediaCard,
  JellyfinMediaCarousel,
} from "@/pages/jellyfin/JellyfinMediaCarousel";
import { HomeLayout } from "@/pages/layouts/HomeLayout";
import { HeroPart } from "@/pages/parts/home/HeroPart";
import { SearchLoadingPart } from "@/pages/parts/search/SearchLoadingPart";
import { usePreferencesStore } from "@/stores/preferences";

type HomeSection = Awaited<ReturnType<typeof getHomeSections>>[number];

export function HomePage() {
  const [showBg, setShowBg] = useState(false);
  const searchParams = useSearchQuery();
  const [search] = searchParams;
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [urlParams, setUrlParams] = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<string | null>(
    urlParams.get("item"),
  );
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [libraries, setLibraries] = useState<JellyfinItem[]>([]);
  const [activeLibrary, setActiveLibrary] = useState("");
  const [results, setResults] = useState<JellyfinItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [resultError, setResultError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestGeneration = useRef(0);
  const enableFeatured = usePreferencesStore((state) => state.enableFeatured);

  useEffect(() => {
    const linkedItem = urlParams.get("item");
    if (linkedItem) setSelectedItem(linkedItem);
  }, [urlParams]);

  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([getHomeSections(), getLibraries()])
      .then(([homeSections, views]) => {
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
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    requestGeneration.current += 1;
    setLoadingMore(false);
    setResultError("");
    setResults([]);
    setTotalResults(0);
    if (!debouncedSearch && !activeLibrary) {
      setLoadingResults(false);
      return () => controller.abort();
    }
    setLoadingResults(true);
    const load = debouncedSearch
      ? searchItems(debouncedSearch, controller.signal).then((items) => ({
          Items: items,
          TotalRecordCount: items.length,
        }))
      : getLibraryItems(activeLibrary, 0, controller.signal);
    load
      .then((data) => {
        if (controller.signal.aborted) return;
        setResults(data.Items);
        setTotalResults(data.TotalRecordCount ?? data.Items.length);
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
        if (!controller.signal.aborted) setLoadingResults(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, activeLibrary, revision]);

  const loadMore = async () => {
    if (loadingMore || !activeLibrary) return;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    setResultError("");
    try {
      const next = await getLibraryItems(activeLibrary, results.length);
      if (generation !== requestGeneration.current) return;
      setResults((current) => [...current, ...next.Items]);
      setTotalResults(next.TotalRecordCount ?? totalResults);
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

  const selectItem = (item: JellyfinItem) => setSelectedItem(item.Id);
  const searching = search.trim().length > 0;
  const showFeatured = enableFeatured && (loading || featured.length > 0);
  const showingGrid = searching || Boolean(activeLibrary);
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
                  className={`text-xl md:text-2xl font-bold p-2 bg-transparent text-center rounded-full cursor-pointer flex items-center whitespace-nowrap transition-transform duration-200 ${activeLibrary === library.Id ? "transform scale-105 text-type-link" : "text-type-secondary"}`}
                  onClick={() => setActiveLibrary(library.Id)}
                >
                  {library.Name}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
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
                : libraries.find((library) => library.Id === activeLibrary)
                    ?.Name}
            </h2>
            {loadingResults || debouncedSearch !== search.trim() ? (
              <SearchLoadingPart />
            ) : (
              <>
                <MediaGrid>
                  {results.map((item) => (
                    <JellyfinMediaCard
                      key={item.Id}
                      item={item}
                      onSelect={selectItem}
                    />
                  ))}
                </MediaGrid>
                {!results.length && !resultError ? (
                  <p className="py-12 text-center">
                    {searching
                      ? "No matching content in your Jellyfin library."
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
                {!searching && results.length < totalResults ? (
                  <div className="flex justify-center py-8">
                    <Button
                      theme="secondary"
                      loading={loadingMore}
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
            {loading ? (
              <JellyfinMediaCarousel
                id="loading-library"
                title="Your library"
                items={[]}
                loading
                onSelect={selectItem}
              />
            ) : (
              sections.map((section) => (
                <JellyfinMediaCarousel
                  key={section.id}
                  {...section}
                  onSelect={selectItem}
                />
              ))
            )}
            {!loading && !error && !sections.length ? (
              <p className="py-20 text-center">
                There are no movies or series available to your Jellyfin
                account.
              </p>
            ) : null}
          </div>
        </WideContainer>
      )}
      {selectedItem ? (
        <JellyfinDetailsModal
          itemId={selectedItem}
          onClose={closeDetails}
          onItemChanged={() => setRevision((value) => value + 1)}
        />
      ) : null}
    </HomeLayout>
  );
}
