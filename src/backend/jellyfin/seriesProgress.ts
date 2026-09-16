import { JellyfinItem } from "./client";

/** Count the server's watched flags across all available seasons. Missing or
 * virtual episodes are not watchable progress, and repeated IDs count once. */
export function seriesProgress(episodes: JellyfinItem[]) {
  const available = new Map<string, JellyfinItem>();
  episodes.forEach((episode) => {
    if (
      episode.Type === "Episode" &&
      !episode.IsMissing &&
      !episode.IsVirtualItem
    )
      available.set(episode.Id, episode);
  });
  const total = available.size;
  const watched = Math.min(
    total,
    [...available.values()].filter((episode) => episode.UserData?.Played)
      .length,
  );
  return { watched, total, percentage: total ? (watched / total) * 100 : 0 };
}
