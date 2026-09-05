import { JellyfinMediaSource } from "./client";

/** Preserve edition names; describe the actual file rather than a provider label. */
export function mediaSourceLabel(source: JellyfinMediaSource): string {
  const video = source.MediaStreams?.find((stream) => stream.Type === "Video");
  const resolution =
    video?.Width && video.Width >= 3800
      ? "4K"
      : video?.Height
        ? `${video.Height}p`
        : undefined;
  const range = video?.VideoRangeType || video?.VideoRange;
  const dynamicRange =
    range && range !== "SDR"
      ? range.replace(/DOVI/gi, "Dolby Vision").replace(/With/g, " + ")
      : undefined;
  const size =
    source.Size && source.Size > 0
      ? `${(source.Size / 1024 ** 3).toFixed(1)} GB`
      : undefined;
  return [
    source.Name || "Original",
    resolution,
    video?.Codec?.toUpperCase(),
    dynamicRange,
    source.Container?.toUpperCase(),
    size,
  ]
    .filter(Boolean)
    .join(" · ");
}
