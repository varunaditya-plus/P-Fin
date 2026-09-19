import { useEffect, useState } from "react";

import {
  SeerrDiscoveryFilters as DiscoveryFilters,
  defaultSeerrFilters,
  getSeerrDiscoveryChoices,
} from "@/backend/seerr/filters";
import { SeerrMediaType } from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { Dropdown, OptionItem } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";

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
  const controls: {
    key: keyof DiscoveryFilters;
    label: string;
    options: OptionItem[];
  }[] = [
    {
      key: "language",
      label: "Original language",
      options: [
        { id: "", name: "Seerr default" },
        { id: "all", name: "All languages" },
        ...(choices?.languages.map((value) => ({
          id: value.iso_639_1,
          name: value.english_name,
        })) ?? []),
      ],
    },
    {
      key: "region",
      label: "Streaming region",
      options: [
        { id: "", name: "All regions" },
        ...(choices?.regions.map((value) => ({
          id: value.iso_3166_1,
          name: value.english_name,
        })) ?? []),
      ],
    },
    {
      key: "genre",
      label: "Genre",
      options: [
        { id: "", name: "All genres" },
        ...(choices?.genres.map((value) => ({
          id: String(value.id),
          name: value.name,
        })) ?? []),
      ],
    },
    {
      key: "sort",
      label: "Sort",
      options: [
        { id: "popularity.desc", name: "Popular" },
        { id: "vote_average.desc", name: "Highest rated" },
        {
          id:
            type === "movie"
              ? "primary_release_date.desc"
              : "first_air_date.desc",
          name: "Newest release",
        },
      ],
    },
  ];
  return (
    <div className="mx-auto max-w-screen-xl mb-8 px-4 relative z-30">
      <div
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
        aria-label="Discovery filters"
      >
        {controls.map((control) => {
          const selected = control.options.find(
            (option) => option.id === filters[control.key],
          ) ?? { id: filters[control.key], name: filters[control.key] };
          return (
            <Dropdown
              key={control.key}
              className="!my-0"
              selectedItem={selected}
              setSelectedItem={(value) =>
                onChange({ ...filters, [control.key]: value.id })
              }
              options={control.options}
              customButton={
                <button
                  type="button"
                  aria-label={`${control.label}: ${selected.name}`}
                  className="tabbable flex max-w-56 items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-type-secondary transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span className="truncate">{selected.name}</span>
                  <Icon icon={Icons.CHEVRON_DOWN} />
                </button>
              }
            />
          );
        })}
        {changed ? (
          <button
            type="button"
            onClick={() => onChange(defaultSeerrFilters)}
            className="tabbable flex items-center gap-2 rounded-full px-3 py-2 text-sm text-type-secondary hover:text-white"
          >
            <Icon icon={Icons.X} />
            Clear filters
          </button>
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
