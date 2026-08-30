import {
  JellyfinItem,
  JellyfinItems,
  getJellyfinSession,
  jellyfinRequest,
} from "@/backend/jellyfin/client";

export type LibrarySortBy =
  | "SortName"
  | "DateCreated"
  | "ProductionYear"
  | "CommunityRating"
  | "Runtime";
export type LibrarySortOrder = "Ascending" | "Descending";
export type LibraryStatus =
  | "all"
  | "IsPlayed"
  | "IsUnplayed"
  | "IsFavorite"
  | "IsResumable";

export interface LibraryOptions {
  startIndex?: number;
  sortBy?: LibrarySortBy;
  sortOrder?: LibrarySortOrder;
  status?: LibraryStatus;
  genre?: string;
  year?: number;
}

export interface LibraryFilters {
  Genres: string[];
  Years: number[];
}

const fields =
  "Overview,Genres,People,MediaSources,MediaStreams,ProviderIds,PrimaryImageAspectRatio,DateCreated";

function itemTypes(library: JellyfinItem) {
  if (library.CollectionType === "boxsets") return "BoxSet";
  if (library.CollectionType === "playlists") return "Playlist";
  return "Movie,Series";
}

export async function getLibraryPage(
  library: JellyfinItem,
  requestedOptions?: LibraryOptions,
  signal?: AbortSignal,
) {
  const options = requestedOptions ?? {};
  const result = await jellyfinRequest<JellyfinItems>(
    `Users/${getJellyfinSession().userId}/Items`,
    { signal },
    {
      ParentId: library.Id,
      Recursive: true,
      IncludeItemTypes: itemTypes(library),
      Fields: fields,
      SortBy: options.sortBy ?? "SortName",
      SortOrder: options.sortOrder ?? "Ascending",
      Filters: options.status === "all" ? undefined : options.status,
      Genres: options.genre || undefined,
      Years: options.year,
      StartIndex: options.startIndex ?? 0,
      Limit: 60,
      EnableUserData: true,
    },
  );
  return {
    ...result,
    FetchedCount: result.Items.length,
    Items: result.Items.filter(
      (item) => !item.IsMissing && !item.IsVirtualItem,
    ),
  };
}

export async function getLibraryFilters(
  library: JellyfinItem,
  signal?: AbortSignal,
): Promise<LibraryFilters> {
  const result = await jellyfinRequest<Partial<LibraryFilters>>(
    "Items/Filters",
    { signal },
    {
      UserId: getJellyfinSession().userId,
      ParentId: library.Id,
      IncludeItemTypes: itemTypes(library),
    },
  );
  return {
    Genres: (result.Genres ?? []).filter(Boolean).sort(),
    Years: (result.Years ?? []).filter(Number.isFinite).sort((a, b) => b - a),
  };
}

export async function getCollectionItems(
  collectionId: string,
  startIndex?: number,
  signal?: AbortSignal,
) {
  const result = await jellyfinRequest<JellyfinItems>(
    `Users/${getJellyfinSession().userId}/Items`,
    { signal },
    {
      ParentId: collectionId,
      Recursive: false,
      IncludeItemTypes: "Movie,Series,Episode,Video,Trailer,MusicVideo",
      Fields: fields,
      SortBy: "SortName",
      SortOrder: "Ascending",
      StartIndex: startIndex ?? 0,
      Limit: 60,
      EnableUserData: true,
    },
  );
  return {
    ...result,
    FetchedCount: result.Items.length,
    Items: result.Items.filter(
      (item) => !item.IsMissing && !item.IsVirtualItem,
    ),
  };
}

export async function getPlaylistItems(
  playlistId: string,
  startIndex?: number,
  signal?: AbortSignal,
) {
  const result = await jellyfinRequest<JellyfinItems>(
    `Playlists/${encodeURIComponent(playlistId)}/Items`,
    { signal },
    {
      UserId: getJellyfinSession().userId,
      StartIndex: startIndex ?? 0,
      Limit: 60,
      Fields: fields,
      EnableUserData: true,
    },
  );
  return {
    ...result,
    FetchedCount: result.Items.length,
    Items: result.Items.map((item, index) => ({
      ...item,
      PlaylistIndex: (startIndex ?? 0) + index,
    })).filter((item) => !item.IsMissing && !item.IsVirtualItem),
  };
}
