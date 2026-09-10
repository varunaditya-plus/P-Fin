import { matchesSettingsSession } from "@/backend/jellyfin/appSettings";
import { cachedHomeSnapshot } from "@/backend/jellyfin/browse";
import {
  JellyfinItem,
  JellyfinItems,
  getImageUrl,
  getJellyfinSession,
  getSimilarItems,
  jellyfinRequest,
} from "@/backend/jellyfin/client";
import {
  getSeerrDetails,
  getSeerrPage,
  seerrFetch,
  seerrImage,
} from "@/backend/seerr/api";
import { SeerrMedia } from "@/backend/seerr/types";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";
import { validateTasteMedia } from "@/stores/taste";

import { buildTasteAffinities, ratingRecency } from "./engine";
import {
  TasteCandidate,
  TasteMedia,
  TasteProfile,
  TasteType,
  normaliseGenres,
  seerrGenreId,
} from "./types";

export interface LibraryTasteCandidate extends TasteCandidate {
  item: JellyfinItem;
}
export interface SeerrTasteCandidate extends TasteCandidate {
  item: SeerrMedia;
}
interface SeerrTasteMetadata extends SeerrMedia {
  genreIds?: number[];
  genres?: { id?: number; name: string }[];
  productionCompanies?: { name: string }[];
  voteCount?: number;
  popularity?: number;
}
export function tasteMediaFromJellyfin(item: JellyfinItem): TasteMedia {
  const type = item.Type === "Movie" ? "movie" : "tv";
  const tmdbId = Number(item.ProviderIds?.Tmdb ?? item.ProviderIds?.tmdb);
  return validateTasteMedia({
    key: "",
    type,
    title: item.Name,
    jellyfinId: item.Id,
    tmdbId: Number.isSafeInteger(tmdbId) && tmdbId > 0 ? tmdbId : undefined,
    year: item.ProductionYear,
    imageTag: item.ImageTags?.Primary,
    genres: item.Genres ?? [],
    studios: item.Studios?.map((studio) => studio.Name) ?? [],
  });
}
export function tasteMediaFromSeerr(item: SeerrTasteMetadata): TasteMedia {
  const year = Number((item.releaseDate ?? item.firstAirDate)?.slice(0, 4));
  return validateTasteMedia({
    key: "",
    type: item.mediaType,
    title: item.title ?? item.name ?? "Untitled",
    tmdbId: item.id,
    year: year || undefined,
    posterPath: item.posterPath ?? undefined,
    genres: normaliseGenres(
      item.genres?.map((genre) => genre.id ?? genre.name) ??
        item.genreIds ??
        [],
    ),
    studios: item.productionCompanies?.map((company) => company.name) ?? [],
  });
}
export function tastePoster(media: TasteMedia) {
  return media.jellyfinId && media.imageTag
    ? getImageUrl(
        {
          Id: media.jellyfinId,
          Name: media.title,
          Type: media.type === "movie" ? "Movie" : "Series",
          ImageTags: { Primary: media.imageTag },
        },
        "Primary",
        400,
      )
    : seerrImage(media.posterPath, "w342");
}
function libraryCandidate(item: JellyfinItem): LibraryTasteCandidate {
  const date = (
    item.UserData as JellyfinItem["UserData"] & { LastPlayedDate?: string }
  )?.LastPlayedDate;
  return {
    item,
    media: tasteMediaFromJellyfin(item),
    watched: item.UserData?.Played,
    favourite: item.UserData?.IsFavorite,
    progress: (item.UserData?.PlaybackPositionTicks ?? 0) > 0,
    lastPlayedAt: date ? Date.parse(date) : undefined,
    quality: item.CommunityRating,
  };
}
function seerrCandidate(item: SeerrTasteMetadata): SeerrTasteCandidate {
  return {
    item,
    media: tasteMediaFromSeerr(item),
    quality: item.voteAverage,
    voteCount: item.voteCount,
    popularity: item.popularity,
  };
}
const libraryCache = new Map<
  string,
  { at: number; value: LibraryTasteCandidate[] }
>();
const libraryPending = new Map<string, Promise<LibraryTasteCandidate[]>>();
export async function getTasteLibrary(signal?: AbortSignal, force = false) {
  signal?.throwIfAborted();
  const session = getJellyfinSession();
  const key = JSON.stringify([
    session.serverUrl,
    session.userId,
    session.accessToken,
  ]);
  const cached = libraryCache.get(key);
  if (!force && cached && Date.now() - cached.at < 60000) return cached.value;
  let pending = libraryPending.get(key);
  if (!pending) {
    pending = (async () => {
      const items = new Map<string, JellyfinItem>();
      let offset = 0;
      let more = true;
      while (more) {
        if (!matchesSettingsSession(session))
          throw new Error("Your Jellyfin account changed.");
        const page = await jellyfinRequest<JellyfinItems>(
          `Users/${session.userId}/Items`,
          {},
          {
            Recursive: true,
            IncludeItemTypes: "Movie,Series",
            Fields: "Genres,Studios,ProviderIds,PrimaryImageAspectRatio",
            EnableUserData: true,
            EnableTotalRecordCount: true,
            SortBy: "SortName",
            StartIndex: offset,
            Limit: 500,
            IsMissing: false,
            IsVirtualItem: false,
          },
        );
        if (!matchesSettingsSession(session))
          throw new Error("Your Jellyfin account changed.");
        const previous = items.size;
        page.Items.filter(
          (item) =>
            ["Movie", "Series"].includes(item.Type) &&
            !item.IsMissing &&
            !item.IsVirtualItem,
        ).forEach((item) => items.set(item.Id, item));
        offset += page.Items.length;
        more =
          page.Items.length > 0 &&
          items.size > previous &&
          (page.TotalRecordCount !== undefined
            ? offset < page.TotalRecordCount
            : page.Items.length === 500);
      }
      const value = [...items.values()].map(libraryCandidate);
      const home = cachedHomeSnapshot();
      const activeItems = home
        ? home.sections
            .filter((section) => ["resume", "next-up"].includes(section.id))
            .flatMap((section) => section.items)
        : (
            await Promise.allSettled([
              jellyfinRequest<JellyfinItems>(
                `Users/${session.userId}/Items/Resume`,
                {},
                { Limit: 100, EnableUserData: true },
              ),
              jellyfinRequest<JellyfinItems>(
                "Shows/NextUp",
                {},
                {
                  UserId: session.userId,
                  Limit: 100,
                  EnableResumable: false,
                  EnableRewatching: false,
                },
              ),
            ])
          ).flatMap((result) =>
            result.status === "fulfilled" ? (result.value?.Items ?? []) : [],
          );
      if (!matchesSettingsSession(session))
        throw new Error("Your Jellyfin account changed.");
      const active = new Set(
        activeItems.map((item) => item.SeriesId ?? item.Id),
      );
      value.forEach((item) => {
        if (active.has(item.item.Id)) item.progress = true;
      });
      libraryCache.clear();
      libraryCache.set(key, { at: Date.now(), value });
      return value;
    })();
    libraryPending.set(key, pending);
    pending.finally(() => libraryPending.delete(key)).catch(() => {});
  }
  const value = await pending;
  signal?.throwIfAborted();
  return value;
}
export function seerrTasteEnabled() {
  return matchesSeerrSession(
    useSeerrConnection.getState().connection,
    useJellyfinAuth.getState().session,
  );
}
export async function getSeerrTastePage(
  type: TasteType,
  page: number,
  signal?: AbortSignal,
) {
  const result = await getSeerrPage(
    `/discover/${type === "movie" ? "movies" : "tv"}?page=${page}`,
    signal,
  );
  return {
    items: result.results.map(seerrCandidate),
    totalPages: result.totalPages,
  };
}
export async function searchTasteMedia(
  query: string,
  source: "library" | "seerr",
  signal?: AbortSignal,
) {
  if (source === "library") {
    const items = await getTasteLibrary(signal);
    const terms = query.toLocaleLowerCase().trim().split(/\s+/);
    return items
      .filter((item) =>
        terms.every((term) =>
          `${item.media.title} ${item.media.year ?? ""}`
            .toLocaleLowerCase()
            .includes(term),
        ),
      )
      .slice(0, 60);
  }
  const result = await getSeerrPage(
    `/search?query=${encodeURIComponent(query)}`,
    signal,
  );
  return result.results.map(seerrCandidate);
}
export async function enrichTasteMedia(
  media: TasteMedia,
  signal?: AbortSignal,
) {
  if (media.genres.length || !media.tmdbId || !seerrTasteEnabled())
    return media;
  const details = await getSeerrDetails(media.tmdbId, media.type, signal);
  return {
    ...tasteMediaFromSeerr(details),
    jellyfinId: media.jellyfinId,
    imageTag: media.imageTag,
  };
}
export async function addLibraryRelatedSeeds(
  items: LibraryTasteCandidate[],
  profile: TasteProfile,
  signal?: AbortSignal,
) {
  const libraryIds = new Map(
    items.map((item) => [item.media.key, item.item.Id]),
  );
  const seeds = Object.values(profile.ratings)
    .filter(
      (rating) =>
        (rating.jellyfinId || libraryIds.has(rating.key)) &&
        ["loved", "liked"].includes(rating.rating),
    )
    .sort((a, b) => b.ratedAt - a.ratedAt)
    .slice(0, 6);
  const byId = new Map(
    items.map((candidate) => [
      candidate.item.Id,
      { ...candidate, relatedSeeds: [] as { key: string; weight: number }[] },
    ]),
  );
  await Promise.allSettled(
    seeds.map(async (seed) => {
      const related = await getSimilarItems(
        seed.jellyfinId ?? libraryIds.get(seed.key)!,
        signal,
      );
      const weight =
        (seed.rating === "loved" ? 4 : 3) * ratingRecency(seed.ratedAt);
      related.forEach((item) =>
        byId.get(item.Id)?.relatedSeeds.push({ key: seed.key, weight }),
      );
    }),
  );
  signal?.throwIfAborted();
  return [...byId.values()];
}
export async function getSeerrTasteCandidates(
  profile: TasteProfile,
  type: TasteType,
  signal?: AbortSignal,
  activity: TasteCandidate[] = [],
) {
  const seeds = Object.values(profile.ratings)
    .filter(
      (rating) =>
        rating.type === type &&
        rating.tmdbId &&
        ["loved", "liked"].includes(rating.rating),
    )
    .sort((a, b) => b.ratedAt - a.ratedAt)
    .slice(0, 3);
  const endpoint = `/discover/${type === "movie" ? "movies" : "tv"}`;
  const genreQueries = [...buildTasteAffinities(profile, type, activity).genres]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([genre]) => seerrGenreId(genre, type))
    .filter(Boolean);
  const franchiseQueries: Record<
    string,
    { studio?: number; collection?: number }
  > = {
    marvel: { studio: 420 },
    dc: { studio: 9993 },
    starwars: { collection: 10 },
    harrypotter: { collection: 1241 },
    lotr: { collection: 119 },
    bond: { collection: 645 },
    fastfurious: { collection: 9485 },
    missionimpossible: { collection: 87359 },
    jurassic: { collection: 328 },
    pixar: { studio: 3 },
  };
  const pages = await Promise.allSettled([
    getSeerrTastePage(type, 1, signal),
    getSeerrTastePage(type, 2, signal),
    ...[...new Set(genreQueries)].map(async (genre) => {
      const page = await getSeerrPage(`${endpoint}?genre=${genre}`, signal);
      return {
        items: page.results.map(seerrCandidate),
        totalPages: page.totalPages,
      };
    }),
    ...(type === "movie"
      ? profile.preferences.franchises.slice(0, 4).map(async (id) => {
          const query = franchiseQueries[id];
          const items = query.collection
            ? (
                await seerrFetch<{ parts: SeerrTasteMetadata[] }>(
                  `/collection/${query.collection}`,
                  { signal },
                )
              ).parts
            : ((
                await getSeerrPage(
                  `${endpoint}?studio=${query.studio}&voteCountGte=50`,
                  signal,
                )
              ).results as SeerrTasteMetadata[]);
          return {
            items: items
              .filter((item) => (item.voteCount ?? 0) >= 50)
              .map((item) => ({
                ...seerrCandidate(item),
                relatedSeeds: [{ key: `franchise:${id}`, weight: 2 }],
              })),
            totalPages: 1,
          };
        })
      : []),
    ...seeds.map(async (seed) => {
      const page = await getSeerrPage(
        `/${type}/${seed.tmdbId}/recommendations`,
        signal,
      );
      return {
        items: page.results.map((item) => ({
          ...seerrCandidate(item),
          relatedSeeds: [
            {
              key: seed.key,
              weight:
                (seed.rating === "loved" ? 4 : 3) * ratingRecency(seed.ratedAt),
            },
          ],
        })),
        totalPages: page.totalPages,
      };
    }),
  ]);
  signal?.throwIfAborted();
  if (pages.every((result) => result.status === "rejected"))
    throw new Error("Could not load Seerr recommendations.");
  const unique = new Map<string, SeerrTasteCandidate>();
  pages.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.items.forEach((item) => {
      const previous = unique.get(item.media.key);
      unique.set(item.media.key, {
        ...item,
        relatedSeeds: [
          ...(previous?.relatedSeeds ?? []),
          ...(item.relatedSeeds ?? []),
        ],
      });
    });
  });
  return [...unique.values()];
}
