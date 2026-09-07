import { getSeerrPage, seerrFetch } from "@/backend/seerr/api";
import { SeerrMedia, SeerrMediaType, SeerrPage } from "@/backend/seerr/types";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";

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

export function cachedSeerrPage(path: string) {
  const key = connectionKey();
  return key ? pages.get(`${key}:${path}`)?.value : undefined;
}

export async function getCachedSeerrPage(
  path: string,
  signal?: AbortSignal,
  force = false,
) {
  const identity = connectionKey();
  // Always go through the authenticated API guard when Seerr has been disabled.
  if (!identity) return getSeerrPage(path, signal);
  const key = `${identity}:${path}`;
  const cached = pages.get(key);
  if (!force && cached && Date.now() - cached.at < 45_000) return cached.value;
  const page = await getSeerrPage(path, signal);
  const value = { ...page, results: uniqueSeerrMedia(page.results) };
  signal?.throwIfAborted();
  if (connectionKey() === identity) {
    if (pages.size >= 40) pages.delete(pages.keys().next().value!);
    pages.set(key, { at: Date.now(), value });
  }
  return value;
}

export async function randomSeerrMedia(
  type: SeerrMediaType,
  signal?: AbortSignal,
  random = Math.random,
) {
  const endpoint = type === "movie" ? "/discover/movies" : "/discover/tv";
  const first = await getCachedSeerrPage(endpoint, signal);
  const totalPages = Math.max(1, Math.min(first.totalPages || 1, 500));
  const pageNumber =
    1 + Math.min(totalPages - 1, Math.floor(random() * totalPages));
  const page =
    pageNumber === 1
      ? first
      : await getCachedSeerrPage(`${endpoint}?page=${pageNumber}`, signal);
  const candidates = page.results.filter((item) => item.mediaType === type);
  const available = candidates.length
    ? candidates
    : first.results.filter((item) => item.mediaType === type);
  return (
    available[
      Math.min(available.length - 1, Math.floor(random() * available.length))
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
