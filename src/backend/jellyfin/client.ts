import { nanoid } from "nanoid";

import { useJellyfinAuth, useJellyfinServers } from "@/stores/jellyfin";

export interface JellyfinMediaStream {
  Index: number;
  Type: string;
  Codec?: string;
  Language?: string;
  DisplayTitle?: string;
  Title?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsOriginal?: boolean;
  IsExternal?: boolean;
  SupportsExternalStream?: boolean;
  DeliveryUrl?: string;
  DeliveryMethod?: string;
  Width?: number;
  Height?: number;
  Channels?: number;
  BitRate?: number;
  VideoRange?: string;
  VideoRangeType?: string;
}

export interface JellyfinMediaSource {
  Id: string;
  Name?: string;
  Container?: string;
  Protocol?: string;
  Path?: string;
  RunTimeTicks?: number;
  Bitrate?: number;
  Size?: number;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  TranscodingUrl?: string;
  MediaStreams?: JellyfinMediaStream[];
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  IsMissing?: boolean;
  IsVirtualItem?: boolean;
  CollectionType?: string;
  Overview?: string;
  OriginalLanguage?: string;
  ProductionYear?: number;
  PremiereDate?: string;
  RunTimeTicks?: number;
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  SeasonName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  SeriesPrimaryImageTag?: string;
  ParentLogoItemId?: string;
  ParentLogoImageTag?: string;
  Genres?: string[];
  Tags?: string[];
  Studios?: { Id?: string; Name: string }[];
  People?: {
    Id: string;
    Name: string;
    Role?: string;
    Type?: string;
    PrimaryImageTag?: string;
  }[];
  OfficialRating?: string;
  CommunityRating?: number;
  ProviderIds?: Record<string, string>;
  ChildCount?: number;
  RecursiveItemCount?: number;
  MediaSources?: JellyfinMediaSource[];
  MediaStreams?: JellyfinMediaStream[];
  UserData?: {
    PlaybackPositionTicks?: number;
    Played?: boolean;
    IsFavorite?: boolean;
    PlayedPercentage?: number;
    UnplayedItemCount?: number;
  };
}

export interface JellyfinItems {
  Items: JellyfinItem[];
  TotalRecordCount?: number;
}
type Query = Record<string, string | number | boolean | undefined>;
const fields =
  "Overview,Genres,People,MediaSources,MediaStreams,ProviderIds,PrimaryImageAspectRatio,DateCreated";

export function getJellyfinSession() {
  const session = useJellyfinAuth.getState().session;
  if (!session) throw new Error("Sign in to Jellyfin to continue.");
  return session;
}

export function jellyfinUrl(path: string, query: Query = {}) {
  const base =
    useJellyfinAuth.getState().session?.serverUrl ??
    useJellyfinServers.getState().selectedServer?.apiUrl ??
    "/jellyfin";
  const url = new URL(
    `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
    window.location.origin,
  );
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export async function jellyfinRequest<T>(
  path: string,
  init: RequestInit = {},
  query: Query = {},
): Promise<T> {
  const session = useJellyfinAuth.getState().session;
  const headers = new Headers(init.headers);
  headers.set(
    "Authorization",
    `MediaBrowser Client="P-Stream", Device="Web browser", DeviceId="${session?.deviceId ?? "p-stream-web"}", Version="1.0.0"${session ? `, Token="${session.accessToken}"` : ""}`,
  );
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(jellyfinUrl(path, query), {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    if (
      response.status === 401 &&
      session &&
      useJellyfinAuth.getState().session?.accessToken === session.accessToken
    )
      useJellyfinAuth.getState().setSession(null);
    throw new Error(
      response.status === 401
        ? "Your Jellyfin session expired. Please sign in again."
        : response.status === 403
          ? "Your Jellyfin account does not have access to this content."
          : `Jellyfin could not complete the request (${response.status}).`,
    );
  }
  if (response.status === 204 || response.headers.get("Content-Length") === "0")
    return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function loginJellyfin(
  username: string,
  password: string,
  persistSession = true,
) {
  const deviceId = nanoid();
  const selectedServer = useJellyfinServers.getState().selectedServer;
  const serverUrl = selectedServer?.apiUrl ?? "/jellyfin";
  const authUrl = new URL(
    `${serverUrl.replace(/\/$/, "")}/Users/AuthenticateByName`,
    window.location.origin,
  ).toString();
  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `MediaBrowser Client="P-Stream", Device="Web browser", DeviceId="${deviceId}", Version="1.0.0"`,
    },
    body: JSON.stringify({ Username: username, Pw: password }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Incorrect Jellyfin username or password."
        : `Unable to sign in to Jellyfin (${response.status}).`,
    );
  const data = (await response.json()) as {
    AccessToken: string;
    User: { Id: string; Name: string };
  };
  const session = {
    serverUrl,
    serverId: selectedServer?.id,
    serverName: selectedServer?.name,
    serverAddress: selectedServer?.url,
    accessToken: data.AccessToken,
    userId: data.User.Id,
    userName: data.User.Name,
    deviceId,
  };
  if (persistSession) useJellyfinAuth.getState().setSession(session);
  return session;
}

export async function logoutJellyfin() {
  const session = useJellyfinAuth.getState().session;
  if (!session) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  // Capture the old token in the request before clearing local authentication.
  const request = jellyfinRequest("Sessions/Logout", {
    method: "POST",
    signal: controller.signal,
  });
  if (useJellyfinAuth.getState().session?.accessToken === session.accessToken)
    useJellyfinAuth.getState().setSession(null);
  try {
    await request;
  } finally {
    clearTimeout(timeout);
  }
}

export function getItem(id: string, signal?: AbortSignal) {
  return jellyfinRequest<JellyfinItem>(
    `Users/${getJellyfinSession().userId}/Items/${encodeURIComponent(id)}`,
    { signal },
  );
}

export async function getLibraries(signal?: AbortSignal) {
  const result = await jellyfinRequest<JellyfinItems>(
    `Users/${getJellyfinSession().userId}/Views`,
    { signal },
  );
  return result.Items.filter((item) =>
    ["movies", "tvshows", "mixed", "boxsets", "playlists"].includes(
      item.CollectionType ?? "mixed",
    ),
  );
}

export function getLibraryItems(
  parentId: string,
  startIndex?: number,
  signal?: AbortSignal,
) {
  return jellyfinRequest<JellyfinItems>(
    `Users/${getJellyfinSession().userId}/Items`,
    { signal },
    {
      ParentId: parentId,
      Recursive: true,
      IncludeItemTypes: "Movie,Series",
      Fields: fields,
      SortBy: "SortName",
      SortOrder: "Ascending",
      StartIndex: startIndex ?? 0,
      Limit: 60,
      EnableUserData: true,
    },
  );
}

export async function searchItems(query: string, signal?: AbortSignal) {
  const result = await jellyfinRequest<JellyfinItems>(
    `Users/${getJellyfinSession().userId}/Items`,
    { signal },
    {
      SearchTerm: query,
      Recursive: true,
      IncludeItemTypes: "Movie,Series",
      Fields: fields,
      Limit: 100,
      EnableUserData: true,
    },
  );
  return result.Items;
}

export async function getSeasons(seriesId: string, signal?: AbortSignal) {
  const result = await jellyfinRequest<JellyfinItems>(
    `Shows/${encodeURIComponent(seriesId)}/Seasons`,
    { signal },
    {
      UserId: getJellyfinSession().userId,
      Fields: fields,
      EnableUserData: true,
    },
  );
  return result.Items;
}

export async function getEpisodes(
  seriesId: string,
  seasonId?: string,
  signal?: AbortSignal,
) {
  const result = await jellyfinRequest<JellyfinItems>(
    `Shows/${encodeURIComponent(seriesId)}/Episodes`,
    { signal },
    {
      UserId: getJellyfinSession().userId,
      SeasonId: seasonId,
      Fields: fields,
      EnableUserData: true,
    },
  );
  return result.Items.filter((item) => !item.IsMissing && !item.IsVirtualItem);
}

export async function getSimilarItems(id: string, signal?: AbortSignal) {
  const result = await jellyfinRequest<JellyfinItems>(
    `Items/${encodeURIComponent(id)}/Similar`,
    { signal },
    { UserId: getJellyfinSession().userId, Fields: fields, Limit: 20 },
  );
  return result.Items.filter((item) => ["Movie", "Series"].includes(item.Type));
}

export function getImageUrl(
  item: JellyfinItem,
  type: "Primary" | "Backdrop" | "Logo" = "Primary",
  maxWidth = 600,
) {
  let id = item.Id;
  let tag =
    type === "Backdrop" ? item.BackdropImageTags?.[0] : item.ImageTags?.[type];
  if (!tag && type === "Backdrop" && item.ParentBackdropItemId) {
    id = item.ParentBackdropItemId;
    tag = item.ParentBackdropImageTags?.[0];
  }
  if (
    !tag &&
    type === "Primary" &&
    item.SeriesId &&
    item.SeriesPrimaryImageTag
  ) {
    id = item.SeriesId;
    tag = item.SeriesPrimaryImageTag;
  }
  if (!tag && type === "Logo" && item.ParentLogoItemId) {
    id = item.ParentLogoItemId;
    tag = item.ParentLogoImageTag;
  }
  if (!tag) return undefined;
  return jellyfinUrl(
    `Items/${id}/Images/${type}${type === "Backdrop" ? "/0" : ""}`,
    { tag, maxWidth, quality: 90 },
  );
}

export function setFavorite(id: string, favorite: boolean) {
  return jellyfinRequest(
    `Users/${getJellyfinSession().userId}/FavoriteItems/${encodeURIComponent(id)}`,
    { method: favorite ? "POST" : "DELETE" },
  );
}
export function setPlayed(id: string, played: boolean) {
  return jellyfinRequest(
    `Users/${getJellyfinSession().userId}/PlayedItems/${encodeURIComponent(id)}`,
    { method: played ? "POST" : "DELETE" },
  );
}

export async function getHomeSections() {
  const userId = getJellyfinSession().userId;
  const libraries = await getLibraries();
  const [resume, nextUp, favorites, ...latest] = await Promise.all([
    jellyfinRequest<JellyfinItems>(
      `Users/${userId}/Items/Resume`,
      {},
      { MediaTypes: "Video", Limit: 20, Fields: fields },
    ),
    jellyfinRequest<JellyfinItems>(
      "Shows/NextUp",
      {},
      {
        UserId: userId,
        Limit: 20,
        Fields: fields,
        EnableResumable: false,
        EnableRewatching: false,
      },
    ),
    jellyfinRequest<JellyfinItems>(
      `Users/${userId}/Items`,
      {},
      {
        Recursive: true,
        IncludeItemTypes: "Movie,Series",
        Filters: "IsFavorite",
        Fields: fields,
        Limit: 30,
      },
    ),
    ...libraries.map((library) =>
      jellyfinRequest<JellyfinItem[]>(
        `Users/${userId}/Items/Latest`,
        {},
        { ParentId: library.Id, Limit: 20, Fields: fields, GroupItems: true },
      ),
    ),
  ]);
  return [
    {
      id: "resume",
      title: "Continue watching",
      items: (resume as JellyfinItems).Items,
    },
    { id: "next-up", title: "Next up", items: (nextUp as JellyfinItems).Items },
    ...libraries.map((library, index) => ({
      id: library.Id,
      title: `Latest ${library.Name}`,
      items: latest[index] as JellyfinItem[],
    })),
    {
      id: "favorites",
      title: "Favourites",
      items: (favorites as JellyfinItems).Items,
    },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          ["Movie", "Series", "Episode"].includes(item.Type) &&
          !item.IsMissing &&
          !item.IsVirtualItem,
      ),
    }))
    .filter((section) => section.items.length > 0);
}

export async function findItemByProviderId(
  tmdbId: number | string,
  type: "movie" | "tv",
) {
  // Jellyfin does not expose its internal AnyProviderIdEquals filter on the
  // public Items endpoint. Compare provider IDs across user-visible pages;
  // otherwise a title beyond the first page incorrectly looks unavailable.
  const userId = getJellyfinSession().userId;
  let startIndex = 0;
  const pageSize = 200;
  let hasMore = true;
  while (hasMore) {
    const result = await jellyfinRequest<JellyfinItems>(
      `Users/${userId}/Items`,
      {},
      {
        Recursive: true,
        IncludeItemTypes: type === "movie" ? "Movie" : "Series",
        Fields: "ProviderIds",
        SortBy: "SortName",
        SortOrder: "Ascending",
        StartIndex: startIndex,
        Limit: pageSize,
      },
    );
    const match = result.Items.find(
      (item) => item.ProviderIds?.Tmdb === String(tmdbId),
    );
    if (match) return match;
    startIndex += result.Items.length;
    hasMore =
      result.Items.length > 0 &&
      (result.TotalRecordCount !== undefined
        ? startIndex < result.TotalRecordCount
        : result.Items.length === pageSize);
  }
  return null;
}
