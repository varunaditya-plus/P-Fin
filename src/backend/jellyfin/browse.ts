import { JellyfinItem } from "@/backend/jellyfin/client";

export function uniqueLibraryItems(items: JellyfinItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.Id) || item.IsMissing || item.IsVirtualItem) return false;
    seen.add(item.Id);
    return true;
  });
}

/** Unicode and punctuation variants should behave like the same title. */
export function normalizeLibrarySearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
