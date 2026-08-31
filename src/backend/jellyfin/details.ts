import { JellyfinItem } from "./client";
import { ContentItem, getContentItem } from "./content";

type DetailsIdentity = Pick<JellyfinItem, "Id" | "Type" | "SeriesId">;

function isSeriesChild(item: Pick<JellyfinItem, "Type">) {
  return item.Type === "Episode" || item.Type === "Season";
}

/** Details belong to the series; playback continues to use the original item ID. */
export function getJellyfinDetailsId(item: DetailsIdentity): string {
  return isSeriesChild(item) && item.SeriesId ? item.SeriesId : item.Id;
}

/** Adapt card selection without passing episode metadata under a series ID. */
export function getJellyfinDetailsTarget(item: JellyfinItem): JellyfinItem {
  const id = getJellyfinDetailsId(item);
  return id === item.Id
    ? item
    : { Id: id, Type: "Series", Name: item.SeriesName || item.Name };
}

/** Resolve deep links and incomplete card metadata without exposing an episode modal. */
export async function resolveJellyfinDetailsItem(
  itemOrId: JellyfinItem | string,
  signal?: AbortSignal,
): Promise<ContentItem> {
  signal?.throwIfAborted();
  let current = await getContentItem(
    typeof itemOrId === "string" ? itemOrId : getJellyfinDetailsId(itemOrId),
    signal,
  );
  signal?.throwIfAborted();
  const requiresSeries =
    (typeof itemOrId !== "string" && isSeriesChild(itemOrId)) ||
    isSeriesChild(current);
  if (!requiresSeries) return current;

  const visited = new Set<string>();
  for (let depth = 0; depth < 4; depth += 1) {
    if (current.Type === "Series") return current;
    if (!isSeriesChild(current) || visited.has(current.Id)) break;
    visited.add(current.Id);
    const parentId =
      current.SeriesId ||
      (current.Type === "Episode" ? current.SeasonId : undefined) ||
      (current as ContentItem & { ParentId?: string }).ParentId;
    if (!parentId || visited.has(parentId)) break;
    signal?.throwIfAborted();
    current = await getContentItem(parentId, signal);
    signal?.throwIfAborted();
  }
  throw new Error(
    "The series for this episode or season is not available in your Jellyfin library.",
  );
}
