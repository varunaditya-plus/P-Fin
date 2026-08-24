import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { searchForMedia } from "@/backend/metadata/search";
import { MWQuery } from "@/backend/metadata/types/mw";
import { IconPatch } from "@/components/buttons/IconPatch";
import { Icons } from "@/components/Icon";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { MediaGrid } from "@/components/media/MediaGrid";
import { WatchedMediaCard } from "@/components/media/WatchedMediaCard";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/pages/About";
import { SearchLoadingPart } from "@/pages/parts/search/SearchLoadingPart";
import { MediaItem } from "@/utils/mediaTypes";

function SearchSuffix(props: { failed?: boolean; results?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const icon: Icons = props.failed ? Icons.WARNING : Icons.EYE_SLASH;

  return (
    <div className="mt-40 flex flex-col items-center justify-center space-y-3 text-center">
      <IconPatch
        icon={icon}
        className={`text-xl ${
          props.failed ? "text-red-400" : "text-type-logo"
        }`}
      />

      {/* standard suffix */}
      {!props.failed ? (
        <div>
          {(props.results ?? 0) > 0 ? (
            <>
              <p>{t("home.search.allResults")}</p>
              <Button
                className="px-py p-[0.3em] mt-3 rounded-xl text-type-dimmed box-content text-[17px] bg-largeCard-background justify-center items-center"
                onClick={() => navigate("/discover")}
              >
                {t("home.search.discoverMore")}
              </Button>
            </>
          ) : (
            <p>{t("home.search.noResults")}</p>
          )}
        </div>
      ) : null}

      {/* Error result */}
      {props.failed ? (
        <div>
          <p>{t("home.search.failed")}</p>
        </div>
      ) : null}
    </div>
  );
}

export function SearchListPart({
  searchQuery,
  onShowDetails,
}: {
  searchQuery: string;
  onShowDetails?: (media: MediaItem) => void;
}) {
  const { t } = useTranslation();

  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestIdRef = useRef(0);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    async function runSearch(query: MWQuery, requestId: number) {
      setLoading(true);
      setFailed(false);

      let nextResults: MediaItem[] = [];
      let didFail = false;
      try {
        nextResults = (await searchForMedia(query)) ?? [];
      } catch {
        didFail = true;
      }

      // Ignore stale responses from older requests.
      if (requestIdRef.current !== requestId) {
        return;
      }

      setFailed(didFail);
      if (!didFail) setResults(nextResults);
      setLoading(false);
    }

    if (debouncedSearchQuery === "") {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    requestIdRef.current += 1;
    runSearch({ searchQuery: debouncedSearchQuery }, requestIdRef.current);
  }, [debouncedSearchQuery]);

  if (loading) return <SearchLoadingPart />;
  if (failed) return <SearchSuffix failed />;
  if (!results) return null;

  return (
    <div>
      {results.length > 0 ? (
        <div>
          <SectionHeading
            title={t("home.search.sectionTitle")}
            icon={Icons.SEARCH}
          />
          <MediaGrid>
            {results.map((v) => (
              <WatchedMediaCard
                key={v.id.toString()}
                media={v}
                onShowDetails={onShowDetails}
              />
            ))}
          </MediaGrid>
        </div>
      ) : null}

      <SearchSuffix results={results.length} />
    </div>
  );
}
