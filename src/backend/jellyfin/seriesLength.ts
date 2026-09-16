import {
  JellyfinItem,
  JellyfinItems,
  getJellyfinSession,
  jellyfinRequest,
} from "@/backend/jellyfin/client";
import { LibraryOptions } from "@/backend/jellyfin/library";

export interface SeriesLengthItem extends JellyfinItem {
  TotalSeriesRunTimeTicks?: number;
  AvailableEpisodeCount?: number;
}

export function aggregateSeriesLengths(
  series: JellyfinItem[],
  episodes: JellyfinItem[],
): SeriesLengthItem[] {
  const lengths = new Map<string, { ticks: number; count: number }>();
  const seen = new Set<string>();
  episodes.forEach((episode) => {
    if (
      seen.has(episode.Id) ||
      !episode.SeriesId ||
      episode.IsMissing ||
      episode.IsVirtualItem
    )
      return;
    seen.add(episode.Id);
    const value = lengths.get(episode.SeriesId) ?? { ticks: 0, count: 0 };
    value.ticks += episode.RunTimeTicks ?? 0;
    value.count += 1;
    lengths.set(episode.SeriesId, value);
  });
  return series.map((item) => ({
    ...item,
    TotalSeriesRunTimeTicks: lengths.get(item.Id)?.ticks ?? 0,
    AvailableEpisodeCount: lengths.get(item.Id)?.count ?? 0,
  }));
}

const cache = new Map<string, { at: number; items: SeriesLengthItem[] }>();

export async function getSeriesLengthPage(
  libraryId: string,
  options: LibraryOptions,
  signal?: AbortSignal,
) {
  const session = getJellyfinSession();
  const identity = JSON.stringify([
    session.serverUrl,
    session.userId,
    session.accessToken,
  ]);
  const key = `${identity}:${libraryId}:${options.status}:${options.genre}:${options.year}`;
  let items = cache.get(key)?.items;
  if (!items || Date.now() - cache.get(key)!.at > 60_000) {
    const loadAll = async (type: "Series" | "Episode") => {
      const result: JellyfinItem[] = [];
      let offset = 0;
      while (!signal?.aborted) {
        signal?.throwIfAborted();
        const current = getJellyfinSession();
        if (
          JSON.stringify([
            current.serverUrl,
            current.userId,
            current.accessToken,
          ]) !== identity
        )
          throw new Error(
            "Your Jellyfin account changed. Open the library again.",
          );
        const page = await jellyfinRequest<JellyfinItems>(
          `Users/${session.userId}/Items`,
          { signal },
          {
            ParentId: libraryId,
            Recursive: true,
            IncludeItemTypes: type,
            Fields:
              type === "Series"
                ? "Overview,ProviderIds,PrimaryImageAspectRatio"
                : undefined,
            Filters:
              type === "Series" && options.status !== "all"
                ? options.status
                : undefined,
            Genres: type === "Series" ? options.genre || undefined : undefined,
            Years: type === "Series" ? options.year : undefined,
            SortBy: "SortName",
            StartIndex: offset,
            Limit: 500,
            IsMissing: false,
            IsVirtualItem: false,
            EnableUserData: type === "Series",
            EnableImages: type === "Series",
          },
        );
        result.push(...page.Items);
        offset += page.Items.length;
        if (
          !page.Items.length ||
          offset >= (page.TotalRecordCount ?? Infinity) ||
          page.Items.length < 500
        )
          break;
      }
      signal?.throwIfAborted();
      return result;
    };
    const [series, episodes] = await Promise.all([
      loadAll("Series"),
      loadAll("Episode"),
    ]);
    signal?.throwIfAborted();
    items = aggregateSeriesLengths(series, episodes);
    if (cache.size > 12) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), items });
  }
  const direction = options.sortOrder === "Descending" ? -1 : 1;
  const sorted = [...items].sort(
    (a, b) =>
      ((a.AvailableEpisodeCount ?? 0) - (b.AvailableEpisodeCount ?? 0)) *
        direction || a.Name.localeCompare(b.Name),
  );
  const start = options.startIndex ?? 0;
  return {
    Items: sorted.slice(start, start + 60),
    TotalRecordCount: sorted.length,
    FetchedCount: Math.min(60, Math.max(0, sorted.length - start)),
  };
}
