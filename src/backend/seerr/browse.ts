import { getSeerrPage, seerrFetch } from "@/backend/seerr/api";
import { SeerrMedia, SeerrMediaType, SeerrPage } from "@/backend/seerr/types";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";

import { createSharedRequest } from "./sharedRequest";

export interface SeerrPerson {
  id: number;
  name: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  placeOfBirth?: string;
  profilePath?: string;
  knownForDepartment?: string;
}

function connectionKey() {
  const connection = useSeerrConnection.getState().connection;
  const session = useJellyfinAuth.getState().session;
  if (!matchesSeerrSession(connection, session)) return undefined;
  return JSON.stringify([
    connection!.url,
    connection!.userId,
    session!.serverUrl,
    session!.userId,
    session!.accessToken,
  ]);
}

export function uniqueSeerrMedia(items: SeerrMedia[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mediaType}:${item.id}`;
    if (!["movie", "tv"].includes(item.mediaType) || seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
}

const pages = new Map<string, { at: number; value: SeerrPage }>();
const sharedPage = createSharedRequest<SeerrPage>();
const readVersions = new Map<string, number>();
let forcedRead = 0;

export function cachedSeerrPage(path: string) {
  const key = connectionKey();
  return key ? pages.get(`${key}:${path}`)?.value : undefined;
}

export async function getCachedSeerrPage(
  path: string,
  signal?: AbortSignal,
  force = false,
) {
  signal?.throwIfAborted();
  const identity = connectionKey();
  // Always go through the authenticated API guard when Seerr has been disabled.
  if (!identity) return getSeerrPage(path, signal);
  const key = `${identity}:${path}`;
  const cached = pages.get(key);
  if (!force && cached && Date.now() - cached.at < 45_000) return cached.value;
  if (force) forcedRead += 1;
  return sharedPage(
    force ? `${key}:refresh:${forcedRead}` : key,
    signal,
    async (sharedSignal) => {
      const version = (readVersions.get(key) ?? 0) + 1;
      readVersions.set(key, version);
      const page = await getSeerrPage(path, sharedSignal);
      sharedSignal.throwIfAborted();
      const value = { ...page, results: uniqueSeerrMedia(page.results) };
      if (connectionKey() === identity && readVersions.get(key) === version) {
        if (pages.size >= 40) pages.delete(pages.keys().next().value!);
        pages.set(key, { at: Date.now(), value });
      }
      return value;
    },
  );
}

export async function randomSeerrMedia(
  type: SeerrMediaType,
  signal?: AbortSignal,
  random?: () => number,
  endpointOverride?: string,
) {
  const choose = random ?? Math.random;
  const endpoint =
    endpointOverride ??
    (type === "movie" ? "/discover/movies" : "/discover/tv");
  const first = await getCachedSeerrPage(endpoint, signal);
  const totalPages = Math.max(1, Math.min(first.totalPages || 1, 500));
  const pageNumber =
    1 + Math.min(totalPages - 1, Math.floor(choose() * totalPages));
  const page =
    pageNumber === 1
      ? first
      : await getCachedSeerrPage(
          `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${pageNumber}`,
          signal,
        );
  const candidates = page.results.filter((item) => item.mediaType === type);
  const available = candidates.length
    ? candidates
    : first.results.filter((item) => item.mediaType === type);
  return (
    available[
      Math.min(available.length - 1, Math.floor(choose() * available.length))
    ] ?? null
  );
}

const popularPicks = new Map<string, { at: number; value: SeerrPage }>();
const sharedPicks = createSharedRequest<SeerrPage>();
const picksVersions = new Map<string, number>();
let picksRefresh = 0;

export function popularPicksPath(type: SeerrMediaType) {
  return `/discover/${type === "movie" ? "movies" : "tv"}?sortBy=popularity.desc&voteAverageGte=6&voteCountGte=${type === "movie" ? 300 : 150}`;
}

export function cachedSeerrPopularPicks(type: SeerrMediaType) {
  const identity = connectionKey();
  return identity ? popularPicks.get(`${identity}:${type}`)?.value : undefined;
}

/** A shuffled page from the well-known popular pool, stable while browsing. */
export async function getSeerrPopularPicks(
  type: SeerrMediaType,
  signal?: AbortSignal,
  force?: boolean,
  random?: () => number,
) {
  signal?.throwIfAborted();
  const identity = connectionKey();
  const path = popularPicksPath(type);
  if (!identity) return getSeerrPage(path, signal);
  const key = `${identity}:${type}`;
  const cached = popularPicks.get(key);
  if (!force && cached && Date.now() - cached.at < 300000) return cached.value;
  if (force) picksRefresh += 1;
  return sharedPicks(
    force ? `${key}:${picksRefresh}` : key,
    signal,
    async (sharedSignal) => {
      const version = (picksVersions.get(key) ?? 0) + 1;
      picksVersions.set(key, version);
      const choose = random ?? Math.random;
      const first = await getCachedSeerrPage(path, sharedSignal, force);
      const pagesInPool = Math.max(
        1,
        Math.min(first.totalPages || 1, type === "movie" ? 50 : 20),
      );
      const targetPage =
        1 + Math.min(pagesInPool - 1, Math.floor(choose() * pagesInPool));
      const selected =
        targetPage === 1
          ? first
          : await getCachedSeerrPage(
              `${path}&page=${targetPage}`,
              sharedSignal,
              force,
            );
      const source = selected.results.length ? selected.results : first.results;
      const results = uniqueSeerrMedia(source).filter(
        (item) => item.mediaType === type,
      );
      for (let index = results.length - 1; index > 0; index -= 1) {
        const other = Math.min(index, Math.floor(choose() * (index + 1)));
        [results[index], results[other]] = [results[other], results[index]];
      }
      sharedSignal.throwIfAborted();
      const value = {
        page: 1,
        totalPages: 1,
        totalResults: Math.min(results.length, 15),
        results: results.slice(0, 15),
      };
      if (connectionKey() === identity && picksVersions.get(key) === version) {
        if (popularPicks.size >= 20)
          popularPicks.delete(popularPicks.keys().next().value!);
        popularPicks.set(key, { at: Date.now(), value });
      }
      return value;
    },
  );
}

export async function findSeerrPerson(name: string, signal?: AbortSignal) {
  const page = await seerrFetch<{
    results: (SeerrPerson & { mediaType: string })[];
  }>(`/search?query=${encodeURIComponent(name)}`, { signal });
  const matches = page.results.filter(
    (person) =>
      person.mediaType === "person" &&
      person.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  return matches.length === 1 ? matches[0].id : undefined;
}

export function getSeerrPerson(id: number, signal?: AbortSignal) {
  return seerrFetch<SeerrPerson>(`/person/${id}`, { signal });
}

export async function getSeerrPersonCredits(id: number, signal?: AbortSignal) {
  const credits = await seerrFetch<{ cast: SeerrMedia[]; crew: SeerrMedia[] }>(
    `/person/${id}/combined_credits`,
    { signal },
  );
  return uniqueSeerrMedia([
    ...(credits.cast ?? []),
    ...(credits.crew ?? []),
  ]).sort((a, b) =>
    (b.releaseDate || b.firstAirDate || "").localeCompare(
      a.releaseDate || a.firstAirDate || "",
    ),
  );
}
