import { JellyfinItem } from "./client";

/** Apply explicit version/chapter links before the user's saved resume point. */
export function getInitialPlaybackSelection(
  item: JellyfinItem,
  search: URLSearchParams,
) {
  const requestedSource = search.get("mediaSourceId");
  const mediaSource = requestedSource
    ? item.MediaSources?.find((source) => source.Id === requestedSource)
    : item.MediaSources?.[0];
  if (requestedSource && !mediaSource)
    throw new Error(
      "This version is no longer available. Choose another version from the details.",
    );
  const trackIndex = (key: "audioIndex" | "subtitleIndex", type: string) => {
    const value = search.get(key);
    if (value === null) return undefined;
    const index = Number(value);
    if (key === "subtitleIndex" && index === -1) return index;
    if (
      !value.trim() ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      !mediaSource?.MediaStreams?.some(
        (stream) => stream.Type === type && stream.Index === index,
      )
    )
      throw new Error(
        `This ${type.toLowerCase()} track is no longer available. Choose another track from the details.`,
      );
    return index;
  };
  const chapter = search.get("startTicks");
  const chapterTicks = chapter === null ? undefined : Number(chapter);
  if (
    chapterTicks !== undefined &&
    (!Number.isSafeInteger(chapterTicks) || chapterTicks < 0)
  )
    throw new Error("This chapter link has an invalid start time.");
  const ticks =
    chapterTicks ??
    (search.get("restart") === "true"
      ? 0
      : (item.UserData?.PlaybackPositionTicks ?? 0));
  const duration = mediaSource?.RunTimeTicks ?? item.RunTimeTicks;
  return {
    mediaSource,
    audioIndex: trackIndex("audioIndex", "Audio"),
    subtitleIndex: trackIndex("subtitleIndex", "Subtitle"),
    startAt:
      Math.max(
        0,
        duration ? Math.min(ticks, Math.max(0, duration - 1_000_000)) : ticks,
      ) / 10_000_000,
  };
}
