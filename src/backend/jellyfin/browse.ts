import {
  JellyfinItem,
  JellyfinItems,
  getHomeSections,
  getJellyfinSession,
  getLibraries,
  jellyfinRequest,
} from "@/backend/jellyfin/client";
import { HomeSectionSort } from "@/stores/jellyfin/browse";

const fields =
  "Overview,Genres,People,ProviderIds,PrimaryImageAspectRatio,ChildCount,DateCreated";

export function uniqueLibraryItems(items: JellyfinItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.Id) || item.IsMissing || item.IsVirtualItem) return false;
    seen.add(item.Id);
    return true;
  });
}

function sessionKey() {
  const session = getJellyfinSession();
  return JSON.stringify([
    session.serverUrl,
    session.userId,
    session.accessToken,
  ]);
}

type HomeSnapshot = {
  sections: Awaited<ReturnType<typeof getHomeSections>>;
  libraries: JellyfinItem[];
};
let homeCache: { key: string; at: number; value: HomeSnapshot } | undefined;
let homePending: { key: string; promise: Promise<HomeSnapshot> } | undefined;

export function cachedHomeSnapshot() {
  return homeCache?.key === sessionKey() ? homeCache.value : undefined;
}

export function getHomeSnapshot(force = false): Promise<HomeSnapshot> {
  const key = sessionKey();
  if (!force && homeCache?.key === key && Date.now() - homeCache.at < 45_000)
    return Promise.resolve(homeCache.value);
  if (homePending?.key === key) return homePending.promise;
  const promise = Promise.all([getHomeSections(), getLibraries()]).then(
    ([sections, libraries]) => {
      const value = {
        sections: sections.map((section) => ({
          ...section,
          items: uniqueLibraryItems(section.items),
        })),
        libraries: uniqueLibraryItems(libraries),
      };
      if (sessionKey() === key) homeCache = { key, at: Date.now(), value };
      return value;
    },
  );
  homePending = { key, promise };
  promise
    .finally(() => {
      if (homePending?.promise === promise) homePending = undefined;
    })
    .catch(() => {});
  return promise;
}

/** Unicode and punctuation variants should behave like the same title. */
export function normalizeLibrarySearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseLibrarySearch(query: string) {
  const normalized = normalizeLibrarySearch(query);
  const tokens = normalized.split(" ").filter(Boolean);
  const yearToken =
    tokens.length > 1
      ? tokens.find((token) => /^(19|20)\d{2}$/.test(token))
      : undefined;
  return {
    title: tokens
      .filter((token) => token !== yearToken)
      .join(" ")
      .replace(/^(?:the|an|a)\s+/, ""),
    year: yearToken ? Number(yearToken) : undefined,
  };
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        above + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

export function librarySearchScore(item: JellyfinItem, query: string) {
  const { title, year } = parseLibrarySearch(query);
  if (year && item.ProductionYear !== year) return 0;
  const name = normalizeLibrarySearch(item.Name).replace(
    /^(?:the|an|a)\s+/,
    "",
  );
  if (name === title) return 1000;
  if (name.startsWith(`${title} `)) return 800;
  if (name.includes(title)) return 600;
  const words = name.split(" ");
  const tokens = title.split(" ");
  let score = 0;
  for (const token of tokens) {
    const match = Math.max(
      ...words.map((word) => {
        if (word === token) return 100;
        if (token.length >= 3 && word.startsWith(token)) return 70;
        const allowed = token.length >= 8 ? 2 : token.length >= 5 ? 1 : 0;
        return allowed && editDistance(word, token) <= allowed ? 40 : 0;
      }),
    );
    if (!match) return 0;
    score += match;
  }
  return score;
}

const searchCache = new Map<string, { at: number; items: JellyfinItem[] }>();

export async function searchLibrary(query: string, signal?: AbortSignal) {
  const session = getJellyfinSession();
  const identity = sessionKey();
  const parsed = parseLibrarySearch(query);
  if (!parsed.title) return [];
  const key = `${identity}:${JSON.stringify(parsed)}`;
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < 30_000) return cached.items;
  const search = async (term: string) => {
    signal?.throwIfAborted();
    const page = await jellyfinRequest<JellyfinItems>(
      `Users/${session.userId}/Items`,
      { signal },
      {
        SearchTerm: term,
        Recursive: true,
        IncludeItemTypes: "Movie,Series,BoxSet,Playlist",
        Fields: fields,
        Years: parsed.year,
        Limit: 120,
        EnableUserData: true,
      },
    );
    return uniqueLibraryItems(page.Items);
  };
  const direct = await search(parsed.title);
  let candidates = direct;
  if (direct.length < 6) {
    const tokens = parsed.title.split(" ").sort((a, b) => b.length - a.length);
    const terms = [
      ...new Set(tokens.flatMap((token) => [token, token.slice(0, 4)])),
    ]
      .filter((term) => term.length >= 3 && term !== parsed.title)
      .slice(0, 2);
    const fallback = await Promise.allSettled(terms.map(search));
    candidates = uniqueLibraryItems([
      ...direct,
      ...fallback.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ),
    ]);
  }
  const collectionIds = new Set<string>();
  const collections = /(?:^|\s)(?:\d+|ii|iii|iv|vi|vii|viii|ix)(?:\s|$)/.test(
    parsed.title,
  )
    ? []
    : direct
        .filter(
          (item) =>
            item.Type === "BoxSet" && librarySearchScore(item, query) >= 600,
        )
        .slice(0, 2);
  const members = await Promise.allSettled(
    collections.map((collection) =>
      jellyfinRequest<JellyfinItems>(
        `Users/${session.userId}/Items`,
        { signal },
        {
          ParentId: collection.Id,
          Recursive: false,
          IncludeItemTypes: "Movie,Series",
          Fields: fields,
          Years: parsed.year,
          SortBy: "PremiereDate,SortName",
          SortOrder: "Ascending",
          Limit: 120,
          EnableUserData: true,
          IsMissing: false,
          IsVirtualItem: false,
        },
      ),
    ),
  );
  const expanded = members.flatMap((result) =>
    result.status === "fulfilled" ? uniqueLibraryItems(result.value.Items) : [],
  );
  expanded.forEach((item) => collectionIds.add(item.Id));
  candidates = uniqueLibraryItems([...candidates, ...expanded]);
  signal?.throwIfAborted();
  if (sessionKey() !== identity)
    throw new Error("Your Jellyfin account changed. Search again.");
  const directIds = new Set(direct.map((item) => item.Id));
  const ranked = candidates
    .map((item) => ({
      item,
      score:
        librarySearchScore(item, query) ||
        (collectionIds.has(item.Id) &&
        (!parsed.year || item.ProductionYear === parsed.year)
          ? 200
          : 0) ||
        ((!parsed.year || item.ProductionYear === parsed.year) &&
        directIds.has(item.Id)
          ? 1
          : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.item.CommunityRating ?? 0) - (a.item.CommunityRating ?? 0) ||
        (b.item.ProductionYear ?? 0) - (a.item.ProductionYear ?? 0) ||
        a.item.Name.localeCompare(b.item.Name) ||
        a.item.Id.localeCompare(b.item.Id),
    )
    .map(({ item }) => item);
  if (searchCache.size >= 30)
    searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(key, { at: Date.now(), items: ranked });
  return ranked;
}

export async function getRandomMovie(signal?: AbortSignal) {
  const page = await jellyfinRequest<JellyfinItems>(
    `Users/${getJellyfinSession().userId}/Items`,
    { signal },
    {
      Recursive: true,
      IncludeItemTypes: "Movie",
      IsMissing: false,
      IsVirtualItem: false,
      SortBy: "Random",
      Limit: 1,
      Fields: fields,
      EnableUserData: true,
    },
  );
  return uniqueLibraryItems(page.Items)[0] ?? null;
}

export async function getHomeFeedPage(
  id: string,
  startIndex?: number,
  genre?: string,
  signal?: AbortSignal,
  limit = 60,
  sort: HomeSectionSort = "default",
) {
  const { userId } = getJellyfinSession();
  const path =
    id === "next-up"
      ? "Shows/NextUp"
      : id === "resume"
        ? `Users/${userId}/Items/Resume`
        : `Users/${userId}/Items`;
  const page = await jellyfinRequest<JellyfinItems>(
    path,
    { signal },
    {
      UserId: userId,
      ParentId: [
        "next-up",
        "resume",
        "favorites",
        "all",
        "recent",
        "completed",
      ].includes(id)
        ? undefined
        : id,
      Recursive: true,
      IncludeItemTypes:
        id === "resume" || id === "next-up" ? undefined : "Movie,Series",
      MediaTypes: "Video",
      Filters:
        id === "favorites"
          ? "IsFavorite"
          : id === "completed"
            ? "IsPlayed"
            : undefined,
      SortBy:
        sort === "title"
          ? "SortName"
          : sort === "year"
            ? "ProductionYear"
            : sort === "rating"
              ? "CommunityRating"
              : id === "all" || id === "favorites"
                ? "SortName"
                : id === "completed"
                  ? "DatePlayed"
                  : "DateCreated",
      SortOrder:
        sort === "title" ||
        (sort === "default" && (id === "all" || id === "favorites"))
          ? "Ascending"
          : "Descending",
      Genres: genre || undefined,
      Fields: fields,
      StartIndex: startIndex ?? 0,
      Limit: Math.min(200, Math.max(1, limit)),
      EnableUserData: true,
      EnableTotalRecordCount: true,
      EnableResumable: false,
      EnableRewatching: false,
    },
  );
  return {
    ...page,
    FetchedCount: page.Items.length,
    Items: uniqueLibraryItems(page.Items),
  };
}

export async function getHomeGenres(signal?: AbortSignal): Promise<string[]> {
  const filters = await jellyfinRequest<{ Genres?: { Name?: string }[] }>(
    "Items/Filters2",
    { signal },
    { UserId: getJellyfinSession().userId, IncludeItemTypes: "Movie,Series" },
  );
  return [
    ...new Set(
      (filters.Genres ?? [])
        .map((genre) => genre.Name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort();
}
