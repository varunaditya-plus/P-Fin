import {
  JellyfinItem,
  JellyfinMediaSource,
  JellyfinMediaStream,
  getItem,
  getJellyfinSession,
  jellyfinRequest,
  jellyfinUrl,
} from "@/backend/jellyfin/client";

export interface ContentStream extends JellyfinMediaStream {
  Profile?: string;
  Level?: number;
  BitDepth?: number;
  PixelFormat?: string;
  VideoRange?: string;
  VideoRangeType?: string;
  RealFrameRate?: number;
  AverageFrameRate?: number;
  AspectRatio?: string;
  SampleRate?: number;
  ChannelLayout?: string;
  ColorSpace?: string;
  ColorTransfer?: string;
  IsHearingImpaired?: boolean;
}
export interface ContentSource extends JellyfinMediaSource {
  Size?: number;
  VideoType?: string;
  MediaStreams?: ContentStream[];
}
export interface ContentItem extends JellyfinItem {
  OriginalTitle?: string;
  OriginalLanguage?: string;
  SortName?: string;
  ForcedSortName?: string;
  Taglines?: string[];
  CriticRating?: number;
  EndDate?: string;
  DateCreated?: string;
  Status?: string;
  AirDays?: string[];
  AirTime?: string;
  ProductionLocations?: string[];
  CustomRating?: string;
  PreferredMetadataLanguage?: string;
  PreferredMetadataCountryCode?: string;
  LockData?: boolean;
  LockedFields?: string[];
  Path?: string;
  CanDelete?: boolean;
  CanDownload?: boolean;
  MediaType?: string;
  MediaSources?: ContentSource[];
  Chapters?: { Name?: string; StartPositionTicks: number; ImageTag?: string }[];
  RemoteTrailers?: { Url: string; Name?: string }[];
  ExternalUrls?: { Name: string; Url: string }[];
  LocalTrailerCount?: number;
  SpecialFeatureCount?: number;
  PlaylistItemId?: string;
}
export interface ContentPolicy {
  IsAdministrator?: boolean;
  EnableContentDownloading?: boolean;
  EnableSubtitleManagement?: boolean;
  EnableCollectionManagement?: boolean;
}
export interface ContentPermissions {
  edit: boolean;
  subtitles: boolean;
  delete: boolean;
  download: boolean;
  collections: boolean;
}
export function contentPermissions(
  item: ContentItem,
  policy: ContentPolicy,
): ContentPermissions {
  const video =
    item.MediaType === "Video" ||
    ["Movie", "Episode", "Video", "Trailer", "MusicVideo"].includes(item.Type);
  return {
    edit: policy.IsAdministrator === true,
    subtitles:
      video &&
      (policy.IsAdministrator === true ||
        policy.EnableSubtitleManagement === true),
    delete: item.CanDelete === true,
    download:
      video &&
      item.CanDownload !== false &&
      policy.EnableContentDownloading === true,
    collections:
      policy.IsAdministrator === true ||
      policy.EnableCollectionManagement === true,
  };
}

export function getContentItem(id: string, signal?: AbortSignal) {
  return getItem(id, signal) as Promise<ContentItem>;
}
export async function getContentPolicy(signal?: AbortSignal) {
  const user = await jellyfinRequest<{ Policy?: ContentPolicy }>("Users/Me", {
    signal,
  });
  return user.Policy ?? {};
}
export function getSpecialFeatures(id: string, signal?: AbortSignal) {
  return jellyfinRequest<ContentItem[]>(
    `Items/${encodeURIComponent(id)}/SpecialFeatures`,
    { signal },
    { UserId: getJellyfinSession().userId },
  );
}
export function getLocalTrailers(id: string, signal?: AbortSignal) {
  return jellyfinRequest<ContentItem[]>(
    `Items/${encodeURIComponent(id)}/LocalTrailers`,
    { signal },
    { UserId: getJellyfinSession().userId },
  );
}
export function contentImageUrl(
  itemId: string,
  type: string,
  index?: number,
  tag?: string,
) {
  return jellyfinUrl(
    `Items/${encodeURIComponent(itemId)}/Images/${encodeURIComponent(type)}/${index ?? 0}`,
    { maxWidth: 700, tag },
  );
}
export function contentDownloadUrl(itemId: string) {
  return jellyfinUrl(`Items/${encodeURIComponent(itemId)}/Download`, {
    ApiKey: getJellyfinSession().accessToken,
  });
}
export function contentStreamUrl(item: ContentItem, sourceId?: string) {
  const source =
    item.MediaSources?.find((entry) => entry.Id === sourceId) ??
    item.MediaSources?.[0];
  return jellyfinUrl(`Videos/${encodeURIComponent(item.Id)}/stream`, {
    Static: true,
    MediaSourceId: source?.Id,
    ApiKey: getJellyfinSession().accessToken,
  });
}
export function safeExternalUrl(value?: string) {
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
export function updateContentMetadata(
  original: ContentItem,
  changes: Partial<ContentItem>,
) {
  // The server uses replacement semantics. Keep all existing fields, including
  // fields the editor does not expose, rather than clearing unrelated metadata.
  return jellyfinRequest<void>(`Items/${encodeURIComponent(original.Id)}`, {
    method: "POST",
    body: JSON.stringify({ ...original, ...changes, Id: original.Id }),
  });
}
export interface MetadataEditorInfo {
  ExternalIdInfos?: { Name: string; Key: string }[];
  Cultures?: {
    DisplayName: string;
    TwoLetterISOLanguageName: string;
    ThreeLetterISOLanguageName: string;
  }[];
  Countries?: { Name: string; TwoLetterISORegionName: string }[];
  ParentalRatingOptions?: { Name: string }[];
}
export function getMetadataEditorInfo(id: string, signal?: AbortSignal) {
  return jellyfinRequest<MetadataEditorInfo>(
    `Items/${encodeURIComponent(id)}/MetadataEditor`,
    { signal },
  );
}
export function refreshContent(
  id: string,
  mode: "missing" | "replace" | "scan",
  replaceImages = false,
) {
  return jellyfinRequest<void>(
    `Items/${encodeURIComponent(id)}/Refresh`,
    { method: "POST" },
    {
      metadataRefreshMode: mode === "scan" ? "None" : "FullRefresh",
      imageRefreshMode: mode === "scan" ? "None" : "FullRefresh",
      replaceAllMetadata: mode === "replace",
      replaceAllImages: replaceImages,
    },
  );
}
export function deleteContent(id: string) {
  return jellyfinRequest<void>(`Items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
export interface ContentImage {
  ImageType: string;
  ImageIndex?: number;
  ImageTag?: string;
  Width?: number;
  Height?: number;
  Size?: number;
}
export function getContentImages(id: string, signal?: AbortSignal) {
  return jellyfinRequest<ContentImage[]>(
    `Items/${encodeURIComponent(id)}/Images`,
    { signal },
  );
}
export function deleteContentImage(id: string, image: ContentImage) {
  return jellyfinRequest<void>(
    `Items/${encodeURIComponent(id)}/Images/${encodeURIComponent(image.ImageType)}/${image.ImageIndex ?? 0}`,
    { method: "DELETE" },
  );
}
export function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("This file could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
}
export async function uploadContentImage(id: string, type: string, file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("Choose a JPEG, PNG, WebP or GIF image.");
  return jellyfinRequest<void>(
    `Items/${encodeURIComponent(id)}/Images/${encodeURIComponent(type)}`,
    {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: await fileBase64(file),
    },
  );
}
export interface RemoteImage {
  Url: string;
  ThumbnailUrl?: string;
  ProviderName?: string;
  Width?: number;
  Height?: number;
  Language?: string;
}
export function getRemoteImages(
  id: string,
  type: string,
  startIndex?: number,
  signal?: AbortSignal,
) {
  return jellyfinRequest<{ Images: RemoteImage[]; TotalRecordCount: number }>(
    `Items/${encodeURIComponent(id)}/RemoteImages`,
    { signal },
    { type, startIndex, limit: 30, includeAllLanguages: true },
  );
}
export function saveRemoteImage(id: string, type: string, imageUrl: string) {
  if (!safeExternalUrl(imageUrl)) throw new Error("The image URL is invalid.");
  return jellyfinRequest<void>(
    `Items/${encodeURIComponent(id)}/RemoteImages/Download`,
    { method: "POST" },
    { type, imageUrl },
  );
}
export function deleteContentSubtitle(id: string, index: number) {
  return jellyfinRequest<void>(
    `Videos/${encodeURIComponent(id)}/Subtitles/${index ?? 0}`,
    { method: "DELETE" },
  );
}
export async function uploadContentSubtitle(
  id: string,
  file: File,
  language: string,
  isForced: boolean,
  isHearingImpaired: boolean,
) {
  const format = file.name.split(".").pop()?.toLowerCase();
  if (!format || !["srt", "ass", "ssa", "vtt", "sub", "ttml"].includes(format))
    throw new Error("Choose an SRT, ASS, SSA, VTT, SUB or TTML subtitle file.");
  if (!/^[a-z]{3}$/i.test(language))
    throw new Error("Enter a three-letter language code, for example eng.");
  return jellyfinRequest<void>(`Videos/${encodeURIComponent(id)}/Subtitles`, {
    method: "POST",
    body: JSON.stringify({
      Language: language,
      Format: format,
      IsForced: isForced,
      IsHearingImpaired: isHearingImpaired,
      Data: await fileBase64(file),
    }),
  });
}
export interface RemoteSubtitle {
  Id: string;
  Name: string;
  ProviderName?: string;
  Format?: string;
  IsHashMatch?: boolean;
  DownloadCount?: number;
  HearingImpaired?: boolean;
}
export function searchContentSubtitles(
  id: string,
  language: string,
  perfectMatch: boolean,
  signal?: AbortSignal,
) {
  if (!/^[a-z]{3}$/i.test(language))
    throw new Error("Enter a three-letter language code, for example eng.");
  return jellyfinRequest<RemoteSubtitle[]>(
    `Items/${encodeURIComponent(id)}/RemoteSearch/Subtitles/${encodeURIComponent(language)}`,
    { signal },
    { isPerfectMatch: perfectMatch },
  );
}
export function downloadContentSubtitle(id: string, subtitleId: string) {
  return jellyfinRequest<void>(
    `Items/${encodeURIComponent(id)}/RemoteSearch/Subtitles/${encodeURIComponent(subtitleId)}`,
    { method: "POST" },
  );
}
export async function getContentContainers(
  type: "BoxSet" | "Playlist",
  signal?: AbortSignal,
) {
  const result: ContentItem[] = [];
  let start = 0;
  while (!signal?.aborted) {
    const page = await jellyfinRequest<{
      Items: ContentItem[];
      TotalRecordCount?: number;
    }>(
      "Items",
      { signal },
      {
        UserId: getJellyfinSession().userId,
        IncludeItemTypes: type,
        Recursive: true,
        SortBy: "SortName",
        StartIndex: start,
        Limit: 100,
      },
    );
    result.push(...page.Items);
    start += page.Items.length;
    if (
      !page.Items.length ||
      start >= (page.TotalRecordCount ?? Infinity) ||
      page.Items.length < 100
    )
      break;
  }
  if (type !== "Playlist") return result;
  const permissions = await Promise.all(
    result.map(async (item) => {
      const permission = await jellyfinRequest<{ CanEdit?: boolean } | null>(
        `Playlists/${encodeURIComponent(item.Id)}/Users/${getJellyfinSession().userId}`,
        { signal },
      ).catch(() => null);
      return permission?.CanEdit ? item : null;
    }),
  );
  return permissions.filter((item): item is ContentItem => item !== null);
}
export function getPlaylistContents(
  id: string,
  startIndex?: number,
  signal?: AbortSignal,
) {
  return jellyfinRequest<{ Items: ContentItem[]; TotalRecordCount?: number }>(
    `Playlists/${encodeURIComponent(id)}/Items`,
    { signal },
    {
      UserId: getJellyfinSession().userId,
      StartIndex: startIndex,
      Limit: 60,
      Fields: "Overview,PrimaryImageAspectRatio,MediaSources",
    },
  );
}
export function addContentToContainer(
  type: "BoxSet" | "Playlist",
  containerId: string,
  itemId: string,
) {
  return jellyfinRequest<void>(
    `${type === "BoxSet" ? "Collections" : "Playlists"}/${encodeURIComponent(containerId)}/Items`,
    { method: "POST" },
    {
      ids: itemId,
      ...(type === "Playlist" ? { userId: getJellyfinSession().userId } : {}),
    },
  );
}
export function createContentContainer(
  type: "BoxSet" | "Playlist",
  name: string,
  itemId: string,
) {
  if (!name.trim()) throw new Error("Enter a name.");
  return type === "BoxSet"
    ? jellyfinRequest<{ Id: string }>(
        "Collections",
        { method: "POST" },
        { name: name.trim(), ids: itemId, isLocked: false },
      )
    : jellyfinRequest<{ Id: string }>("Playlists", {
        method: "POST",
        body: JSON.stringify({
          Name: name.trim(),
          Ids: [itemId],
          UserId: getJellyfinSession().userId,
          MediaType: "Video",
          IsPublic: false,
        }),
      });
}
export interface PlaylistConfiguration {
  OpenAccess: boolean;
}
export function getPlaylistConfiguration(id: string, signal?: AbortSignal) {
  return jellyfinRequest<PlaylistConfiguration>(
    `Playlists/${encodeURIComponent(id)}`,
    { signal },
  );
}
export function getPlaylistEditPermission(id: string, signal?: AbortSignal) {
  return jellyfinRequest<{ CanEdit: boolean }>(
    `Playlists/${encodeURIComponent(id)}/Users/${getJellyfinSession().userId}`,
    { signal },
  );
}
export function updatePlaylistDetails(
  id: string,
  changes: { Name?: string; IsPublic?: boolean },
) {
  const name = changes.Name?.trim();
  if (changes.Name !== undefined && !name)
    throw new Error("Enter a playlist name.");
  return jellyfinRequest<void>(`Playlists/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({
      ...(name !== undefined ? { Name: name } : {}),
      ...(changes.IsPublic !== undefined ? { IsPublic: changes.IsPublic } : {}),
    }),
  });
}
export function removeContentFromContainer(
  type: "BoxSet" | "Playlist",
  containerId: string,
  entryId: string,
) {
  if (!entryId)
    throw new Error("This item cannot be removed without its entry ID.");
  return jellyfinRequest<void>(
    `${type === "BoxSet" ? "Collections" : "Playlists"}/${encodeURIComponent(containerId)}/Items`,
    { method: "DELETE" },
    type === "BoxSet" ? { ids: entryId } : { entryIds: entryId },
  );
}
export function movePlaylistEntry(
  playlistId: string,
  entryId: string,
  newIndex: number,
) {
  if (!entryId || !Number.isSafeInteger(newIndex) || newIndex < 0)
    throw new Error("This playlist entry cannot be moved.");
  return jellyfinRequest<void>(
    `Playlists/${encodeURIComponent(playlistId)}/Items/${encodeURIComponent(entryId)}/Move/${newIndex}`,
    { method: "POST" },
  );
}
export interface ContentSearchResult {
  Name?: string;
  ProductionYear?: number;
  ProviderIds: Record<string, string>;
  ImageUrl?: string;
  SearchProviderName?: string;
  Overview?: string;
}
export function searchContentIdentity(
  item: ContentItem,
  name: string,
  year?: number,
  providerIds: Record<string, string> = {},
) {
  return jellyfinRequest<ContentSearchResult[]>(
    `Items/RemoteSearch/${encodeURIComponent(item.Type)}`,
    {
      method: "POST",
      body: JSON.stringify({
        ItemId: item.Id,
        SearchInfo: { Name: name, Year: year, ProviderIds: providerIds },
        IncludeDisabledProviders: false,
      }),
    },
  );
}
export function applyContentIdentity(
  id: string,
  result: ContentSearchResult,
  replaceImages: boolean,
) {
  return jellyfinRequest<void>(
    `Items/RemoteSearch/Apply/${encodeURIComponent(id)}`,
    { method: "POST", body: JSON.stringify(result) },
    { replaceAllImages: replaceImages },
  );
}
