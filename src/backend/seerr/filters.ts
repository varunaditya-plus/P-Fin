import { seerrFetch } from "./api";
import { SeerrMediaType } from "./types";

export interface SeerrDiscoveryFilters {
  language: string;
  region: string;
  genre: string;
  sort:
    | "popularity.desc"
    | "vote_average.desc"
    | "primary_release_date.desc"
    | "first_air_date.desc";
}
export const defaultSeerrFilters: SeerrDiscoveryFilters = {
  language: "",
  region: "",
  genre: "",
  sort: "popularity.desc",
};

export function readSeerrFilters(
  params: URLSearchParams,
): SeerrDiscoveryFilters {
  const language = params.get("lang") || "";
  const region = params.get("region") || "";
  const genre = params.get("genre") || "";
  const sort = params.get("sort") || "popularity.desc";
  return {
    language: /^(?:[a-z]{2,3}|all)$/.test(language) ? language : "",
    region: /^[A-Z]{2}$/.test(region) ? region : "",
    genre: /^\d+$/.test(genre) ? genre : "",
    sort: [
      "popularity.desc",
      "vote_average.desc",
      "primary_release_date.desc",
      "first_air_date.desc",
    ].includes(sort)
      ? (sort as SeerrDiscoveryFilters["sort"])
      : "popularity.desc",
  };
}

export async function getSeerrDiscoveryChoices(
  type: SeerrMediaType,
  signal?: AbortSignal,
) {
  const [languages, regions, genres] = await Promise.all([
    seerrFetch<{ iso_639_1: string; english_name: string; name: string }[]>(
      "/languages",
      { signal },
    ),
    seerrFetch<{ iso_3166_1: string; english_name: string }[]>("/regions", {
      signal,
    }),
    seerrFetch<{ id: number; name: string }[]>(`/genres/${type}`, { signal }),
  ]);
  return {
    languages: languages.sort((a, b) =>
      a.english_name.localeCompare(b.english_name),
    ),
    regions: regions.sort((a, b) =>
      a.english_name.localeCompare(b.english_name),
    ),
    genres,
  };
}

export function seerrDiscoveryPath(
  type: SeerrMediaType,
  filters: SeerrDiscoveryFilters,
  providerIds?: number[],
) {
  const query = new URLSearchParams();
  if (filters.language) query.set("language", filters.language);
  if (filters.genre) query.set("genre", filters.genre);
  query.set("sortBy", filters.sort);
  if (filters.sort === "vote_average.desc") query.set("voteCountGte", "100");
  if (filters.region) {
    query.set("watchRegion", filters.region);
    // TMDB's watchRegion alone does not constrain results. Pair it with the
    // providers Seerr reports for that region, rather than displaying a false filter.
    query.set(
      "watchProviders",
      (providerIds?.length ? providerIds : [0]).join("|"),
    );
  }
  return `/discover/${type === "movie" ? "movies" : "tv"}?${query}`;
}

export async function filteredSeerrPath(
  type: SeerrMediaType,
  filters: SeerrDiscoveryFilters,
  signal?: AbortSignal,
) {
  if (!filters.region) return seerrDiscoveryPath(type, filters);
  const providers = await seerrFetch<{ id: number }[]>(
    `/watchproviders/${type === "movie" ? "movies" : "tv"}?watchRegion=${encodeURIComponent(filters.region)}`,
    { signal },
  );
  return seerrDiscoveryPath(
    type,
    filters,
    providers.map((provider) => provider.id),
  );
}
