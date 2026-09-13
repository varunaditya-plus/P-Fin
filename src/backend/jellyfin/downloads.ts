import { decodeSubtitle } from "@/backend/helpers/subs";
import { getJellyfinSession, jellyfinUrl } from "@/backend/jellyfin/client";
import {
  ContentItem,
  ContentSource,
  ContentStream,
} from "@/backend/jellyfin/content";

export function selectedDownloadSource(item: ContentItem, sourceId?: string) {
  return (
    item.MediaSources?.find((source) => source.Id === sourceId) ??
    item.MediaSources?.[0]
  );
}
export function downloadFileName(item: ContentItem, source?: ContentSource) {
  const path = source?.Path ?? (source?.Id === item.Id ? item.Path : undefined);
  return (
    path?.split(/[\\/]/).pop() ||
    `${item.Name}${source?.Container ? `.${source.Container}` : ""}`
  );
}
export function downloadSize(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes) || bytes < 0) return "Size unavailable";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
export function originalDownloadId(item: ContentItem, source?: ContentSource) {
  if (source?.Protocol && source.Protocol !== "File") return undefined;
  // Static file sources use the underlying library item's ID. The Download
  // endpoint does not support MediaSourceId and otherwise downloads the first version.
  if (
    source &&
    /^[a-f\d]{32}$|^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(source.Id)
  )
    return source.Id;
  if (
    !source ||
    source.Id === item.Id ||
    (source.Path && source.Path === item.Path)
  )
    return item.Id;
  return undefined;
}
export function originalDownloadUrl(item: ContentItem, source?: ContentSource) {
  const id = originalDownloadId(item, source);
  return id
    ? jellyfinUrl(`Items/${encodeURIComponent(id)}/Download`, {
        ApiKey: getJellyfinSession().accessToken,
      })
    : undefined;
}
export function downloadStreamUrl(item: ContentItem, source?: ContentSource) {
  return jellyfinUrl(`Videos/${encodeURIComponent(item.Id)}/stream`, {
    Static: true,
    MediaSourceId: source?.Id,
    ApiKey: getJellyfinSession().accessToken,
  });
}
export function downloadableSubtitle(stream: ContentStream) {
  return (
    stream.Type === "Subtitle" &&
    [
      "srt",
      "subrip",
      "ass",
      "ssa",
      "vtt",
      "webvtt",
      "mov_text",
      "text",
      "ttml",
      "dfxp",
      "sami",
      "smi",
      "subviewer",
      "microdvd",
    ].includes(stream.Codec?.toLowerCase() ?? "")
  );
}
export function subtitleDownloadName(
  item: ContentItem,
  stream: ContentStream,
  format: "srt" | "vtt",
) {
  const title =
    item.Type === "Episode"
      ? `${item.SeriesName ?? item.Name}.S${String(item.ParentIndexNumber ?? 0).padStart(2, "0")}E${String(item.IndexNumber ?? 0).padStart(2, "0")}`
      : item.Name;
  return `${title}.${stream.Language ?? "und"}.${stream.Index}${stream.IsForced ? ".forced" : ""}.${format}`.replace(
    // eslint-disable-next-line no-control-regex
    /[<>:"/\\|?*\u0000-\u001f]/g,
    "_",
  );
}
export async function downloadSubtitleFile(
  item: ContentItem,
  source: ContentSource,
  stream: ContentStream,
  format: "srt" | "vtt",
  signal?: AbortSignal,
) {
  if (
    !downloadableSubtitle(stream) ||
    !source.MediaStreams?.some(
      (track) => track.Index === stream.Index && downloadableSubtitle(track),
    )
  )
    throw new Error("Choose an available text subtitle track.");
  const owner = getJellyfinSession();
  const url = jellyfinUrl(
    `Videos/${encodeURIComponent(item.Id)}/${encodeURIComponent(source.Id)}/Subtitles/${stream.Index}/Stream.${format}`,
    { ApiKey: owner.accessToken },
  );
  const response = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Jellyfin could not export this subtitle (${response.status}).`,
    );
  if (Number(response.headers.get("content-length")) > 10_000_000)
    throw new Error("This subtitle file is too large.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 10_000_000)
    throw new Error("This subtitle file is too large.");
  const current = getJellyfinSession();
  if (
    owner.accessToken !== current.accessToken ||
    owner.serverUrl !== current.serverUrl
  )
    throw new Error("Your Jellyfin account changed. Try the download again.");
  const text = decodeSubtitle(
    buffer,
    response.headers.get("content-type") ?? "",
  );
  if (!text.trim())
    throw new Error("Jellyfin returned an empty subtitle file.");
  return {
    text,
    filename: subtitleDownloadName(item, stream, format),
    contentType:
      format === "vtt"
        ? "text/vtt;charset=utf-8"
        : "application/x-subrip;charset=utf-8",
  };
}
