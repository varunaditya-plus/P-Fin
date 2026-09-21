import { seerrFetch } from "./api";
import { getCachedSeerrPage, uniqueSeerrMedia } from "./browse";
import { SeerrDetails, SeerrMedia, SeerrMediaType } from "./types";

export interface SeerrCollection {
  id: number;
  name: string;
  overview?: string;
  parts: SeerrMedia[];
}
export function seerrTrailers(details: SeerrDetails) {
  const seen = new Set<string>();
  return (details.relatedVideos ?? [])
    .filter((video) => {
      if (
        video.site !== "YouTube" ||
        !/^[a-zA-Z0-9_-]{11}$/.test(video.key) ||
        seen.has(video.key)
      )
        return false;
      seen.add(video.key);
      return true;
    })
    .sort(
      (a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer"),
    );
}
export async function getSeerrSimilar(
  id: number,
  type: SeerrMediaType,
  signal?: AbortSignal,
) {
  const page = await getCachedSeerrPage(`/${type}/${id}/similar`, signal);
  return uniqueSeerrMedia(page.results).filter(
    (item) => item.id !== id || item.mediaType !== type,
  );
}
export async function getSeerrCollection(id: number, signal?: AbortSignal) {
  const collection = await seerrFetch<SeerrCollection>(`/collection/${id}`, {
    signal,
  });
  return {
    ...collection,
    parts: uniqueSeerrMedia(
      (collection.parts ?? []).map((item) => ({ ...item, mediaType: "movie" })),
    ),
  };
}
export function sortCollectionParts(
  parts: SeerrMedia[],
  sort: "release" | "rating",
) {
  return [...parts].sort((a, b) =>
    sort === "rating"
      ? (b.voteAverage ?? 0) - (a.voteAverage ?? 0)
      : (a.releaseDate || "9999").localeCompare(b.releaseDate || "9999"),
  );
}
