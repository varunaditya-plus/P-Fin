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

export interface SeerrPersonCredit extends SeerrMedia {
  character?: string;
  job?: string;
}
export interface SeerrFilmography {
  acting: SeerrPersonCredit[];
  directing: SeerrPersonCredit[];
}
export function sortPersonCredits(credits: SeerrPersonCredit[]) {
  const unique = new Map<string, SeerrPersonCredit>();
  for (const credit of credits) {
    if (!["movie", "tv"].includes(credit.mediaType)) continue;
    const key = `${credit.mediaType}:${credit.id}`;
    const existing = unique.get(key);
    if (!existing || (credit.popularity ?? 0) > (existing.popularity ?? 0))
      unique.set(key, credit);
  }
  return [...unique.values()].sort((a, b) => {
    const year = (item: SeerrMedia) =>
      parseInt(
        (item.releaseDate || item.firstAirDate || "0").slice(0, 4),
        10,
      ) || 0;
    return year(b) - year(a) || (b.popularity ?? 0) - (a.popularity ?? 0);
  });
}
export async function getSeerrPersonCredits(
  id: number,
  signal?: AbortSignal,
): Promise<SeerrFilmography> {
  const credits = await seerrFetch<{
    cast: SeerrPersonCredit[];
    crew: SeerrPersonCredit[];
  }>(`/person/${id}/combined_credits`, { signal });
  return {
    acting: sortPersonCredits(credits.cast ?? []),
    directing: sortPersonCredits(
      (credits.crew ?? []).filter((credit) => credit.job === "Director"),
    ),
  };
}
