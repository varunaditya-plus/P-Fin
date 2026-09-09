import { useEffect, useState } from "react";

import {
  SeerrDiscoveryFilters as DiscoveryFilters,
  defaultSeerrFilters,
  getSeerrDiscoveryChoices,
} from "@/backend/seerr/filters";
import { SeerrMediaType } from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";

export function SeerrDiscoveryFilters({
  type,
  filters,
  onChange,
}: {
  type: SeerrMediaType;
  filters: DiscoveryFilters;
  onChange: (filters: DiscoveryFilters) => void;
}) {
  const [choices, setChoices] =
    useState<Awaited<ReturnType<typeof getSeerrDiscoveryChoices>>>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getSeerrDiscoveryChoices(type, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setChoices(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Filters are unavailable.",
          );
      });
    return () => controller.abort();
  }, [type, retry]);
  const changed =
    filters.language ||
    filters.region ||
    filters.genre ||
    filters.sort !== "popularity.desc";
  return (
    <div className="mx-auto max-w-screen-xl mb-8 px-4">
      <div
        className="flex items-end gap-3 overflow-x-auto pb-3 scrollbar-none"
        aria-label="Discovery filters"
      >
        <label className="flex shrink-0 flex-col gap-2 text-sm text-type-secondary">
          Original language
          <select
            aria-label="Discovery language"
            className="max-w-48 rounded-lg bg-dropdown-background px-4 py-3 text-white"
            value={filters.language}
            onChange={(event) =>
              onChange({ ...filters, language: event.target.value })
            }
          >
            <option value="">Seerr default</option>
            <option value="all">All languages</option>
            {choices?.languages.map((language) => (
              <option key={language.iso_639_1} value={language.iso_639_1}>
                {language.english_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex shrink-0 flex-col gap-2 text-sm text-type-secondary">
          Streaming region
          <select
            aria-label="Discovery region"
            className="max-w-48 rounded-lg bg-dropdown-background px-4 py-3 text-white"
            value={filters.region}
            onChange={(event) =>
              onChange({ ...filters, region: event.target.value })
            }
          >
            <option value="">All regions</option>
            {choices?.regions.map((region) => (
              <option key={region.iso_3166_1} value={region.iso_3166_1}>
                {region.english_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex shrink-0 flex-col gap-2 text-sm text-type-secondary">
          Genre
          <select
            aria-label="Discovery genre"
            className="max-w-48 rounded-lg bg-dropdown-background px-4 py-3 text-white"
            value={filters.genre}
            onChange={(event) =>
              onChange({ ...filters, genre: event.target.value })
            }
          >
            <option value="">All genres</option>
            {choices?.genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex shrink-0 flex-col gap-2 text-sm text-type-secondary">
          Sort
          <select
            aria-label="Discovery sort"
            className="max-w-48 rounded-lg bg-dropdown-background px-4 py-3 text-white"
            value={filters.sort}
            onChange={(event) =>
              onChange({
                ...filters,
                sort: event.target.value as DiscoveryFilters["sort"],
              })
            }
          >
            <option value="popularity.desc">Popular</option>
            <option value="vote_average.desc">Highest rated</option>
            <option
              value={
                type === "movie"
                  ? "primary_release_date.desc"
                  : "first_air_date.desc"
              }
            >
              Newest release
            </option>
          </select>
        </label>
        {changed ? (
          <Button
            theme="secondary"
            className="shrink-0"
            onClick={() => onChange(defaultSeerrFilters)}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm">
            {error}
          </p>
          <Button
            theme="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
