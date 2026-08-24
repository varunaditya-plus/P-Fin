import Fuse from "fuse.js";

import { SimpleCache } from "@/utils/cache";
import { MediaItem } from "@/utils/mediaTypes";

import {
  formatTMDBMetaToMediaItem,
  formatTMDBSearchResult,
  getMediaDetails,
  getMediaPoster,
  multiSearch,
} from "./tmdb";
import {
  TMDBContentTypes,
  TMDBMovieSearchResult,
  TMDBShowSearchResult,
} from "./types/tmdb";

export interface MWQuery {
  searchQuery: string;
}

const cache = new SimpleCache<MWQuery, MediaItem[]>();
cache.setCompare((a, b) => {
  return a.searchQuery.trim() === b.searchQuery.trim();
});
cache.initialize();

// detect "tmdb:123456" or "tmdb:123456:movie" or "tmdb:123456:tv"
const tmdbIdPattern = /^tmdb:(\d+)(?::(movie|tv))?$/i;
const trailingYearPattern = /\s+\b(19|20)\d{2}\b$/;

function normalizeQuery(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLenientQueries(searchQuery: string): string[] {
  const base = searchQuery.trim();
  if (base.length < 3) return [base];

  const normalized = normalizeQuery(base);
  const withoutTrailingYear = base.replace(trailingYearPattern, "").trim();
  const normalizedWithoutYear = normalizeQuery(withoutTrailingYear);

  const variants = [
    ...new Set([base, normalized, withoutTrailingYear, normalizedWithoutYear]),
  ].filter((q) => q.length > 0);

  // Keep fanout small to avoid TMDB rate-limit pressure.
  return variants.slice(0, 2);
}

function dedupeTMDBResults(
  items: (TMDBMovieSearchResult | TMDBShowSearchResult)[],
): (TMDBMovieSearchResult | TMDBShowSearchResult)[] {
  const deduped = new Map<
    string,
    TMDBMovieSearchResult | TMDBShowSearchResult
  >();

  items.forEach((item) => {
    deduped.set(`${item.media_type}:${item.id}`, item);
  });

  return Array.from(deduped.values());
}

function rankTMDBResultsFuzzy(
  items: (TMDBMovieSearchResult | TMDBShowSearchResult)[],
  query: string,
): (TMDBMovieSearchResult | TMDBShowSearchResult)[] {
  if (items.length <= 1) return items;

  const fuse = new Fuse(items, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.45,
    minMatchCharLength: 2,
    keys: [
      { name: "title", weight: 0.6 },
      { name: "name", weight: 0.6 },
      { name: "original_title", weight: 0.2 },
      { name: "original_name", weight: 0.2 },
    ],
  });

  const ranked = fuse.search(query).map((result) => result.item);
  const rankedSet = new Set(
    ranked.map((item) => `${item.media_type}:${item.id}`),
  );
  const remainder = items.filter(
    (item) => !rankedSet.has(`${item.media_type}:${item.id}`),
  );

  return ranked.concat(remainder);
}

export async function searchForMedia(query: MWQuery): Promise<MediaItem[]> {
  if (cache.has(query)) return cache.get(query) as MediaItem[];
  const { searchQuery } = query;

  // Check if query is a TMDB ID
  const tmdbMatch = searchQuery.match(tmdbIdPattern);
  if (tmdbMatch) {
    const id = tmdbMatch[1];
    const type =
      tmdbMatch[2]?.toLowerCase() === "tv"
        ? TMDBContentTypes.TV
        : TMDBContentTypes.MOVIE;

    try {
      const details = await getMediaDetails(id, type);
      if (details) {
        // Format the media details to our common format
        const mediaResult =
          type === TMDBContentTypes.MOVIE
            ? {
                id: details.id,
                title: (details as any).title,
                poster: getMediaPoster((details as any).poster_path),
                object_type: type,
                original_release_date: new Date((details as any).release_date),
              }
            : {
                id: details.id,
                title: (details as any).name,
                poster: getMediaPoster((details as any).poster_path),
                object_type: type,
                original_release_date: new Date(
                  (details as any).first_air_date,
                ),
              };

        const mediaItem = formatTMDBMetaToMediaItem(mediaResult);
        const result = [mediaItem];
        cache.set(query, result, 3600);
        return result;
      }
    } catch (error) {
      console.error("Error fetching by TMDB ID:", error);
    }
  }

  const queryVariants = getLenientQueries(searchQuery);
  const settledResults = await Promise.allSettled(
    queryVariants.map((q) => multiSearch(q)),
  );
  const fulfilledResults = settledResults
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        (TMDBMovieSearchResult | TMDBShowSearchResult)[]
      > => result.status === "fulfilled",
    )
    .map((result) => result.value);

  if (fulfilledResults.length === 0) {
    return [];
  }

  const data = dedupeTMDBResults(fulfilledResults.flat());
  const rankedData = rankTMDBResultsFuzzy(data, searchQuery);

  const results = rankedData.map((v) => {
    const formattedResult = formatTMDBSearchResult(v, v.media_type);
    return formatTMDBMetaToMediaItem(formattedResult);
  });

  const movieWithPosters = results.filter((movie) => movie.poster);
  const movieWithoutPosters = results.filter((movie) => !movie.poster);

  const sortedresult = movieWithPosters.concat(movieWithoutPosters);

  // cache results for 1 hour
  cache.set(query, sortedresult, 3600);
  return sortedresult;
}
