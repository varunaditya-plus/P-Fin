import { JellyfinItem } from "./client";

function score(id: string, seed: string) {
  let hash = 2166136261;
  for (const char of `${seed}:${id}`) {
    // eslint-disable-next-line no-bitwise
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  // eslint-disable-next-line no-bitwise
  return hash >>> 0;
}

/** Stable across next/previous routes and reloads; never adds inaccessible episodes. */
export function episodeQueue(episodes: JellyfinItem[], seed?: string | null) {
  const unique = [
    ...new Map(
      episodes
        .filter((episode) => !episode.IsMissing && !episode.IsVirtualItem)
        .map((episode) => [episode.Id, episode]),
    ).values(),
  ];
  if (!seed || !/^[a-f0-9]{1,8}$/i.test(seed)) return unique;
  return unique.sort(
    (a, b) => score(a.Id, seed) - score(b.Id, seed) || a.Id.localeCompare(b.Id),
  );
}

export function matchesEpisode(episode: JellyfinItem, query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  if (/^\d+$/.test(q)) return episode.IndexNumber === Number(q);
  const reference = q.match(/^s(\d+)\s*e(\d+)$/i);
  if (reference)
    return (
      episode.ParentIndexNumber === Number(reference[1]) &&
      episode.IndexNumber === Number(reference[2])
    );
  return `${episode.Name} ${episode.Overview ?? ""}`
    .toLocaleLowerCase()
    .includes(q);
}
