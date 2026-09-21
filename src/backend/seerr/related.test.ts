// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seerrFetch } from "./api";
import { getCachedSeerrPage } from "./browse";
import {
  getSeerrCollection,
  getSeerrSimilar,
  seerrTrailers,
  sortCollectionParts,
} from "./related";

vi.mock("./api", () => ({ seerrFetch: vi.fn() }));
vi.mock("./browse", async (original) => ({
  ...(await original<typeof import("./browse")>()),
  getCachedSeerrPage: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
});
describe("Seerr related metadata", () => {
  it("accepts only valid YouTube video keys, deduplicates and puts trailers first", () => {
    expect(
      seerrTrailers({
        id: 1,
        mediaType: "movie",
        relatedVideos: [
          {
            site: "YouTube",
            key: "abcdefghijk",
            name: "Teaser",
            type: "Teaser",
          },
          {
            site: "YouTube",
            key: "123456789ab",
            name: "Trailer",
            type: "Trailer",
          },
          {
            site: "YouTube",
            key: "abcdefghijk",
            name: "Duplicate",
            type: "Clip",
          },
          { site: "Other", key: "abcdefghijq", name: "Other", type: "Trailer" },
          {
            site: "YouTube",
            key: "../unsafe",
            name: "Unsafe",
            type: "Trailer",
          },
        ],
      }).map((video) => video.name),
    ).toEqual(["Trailer", "Teaser"]);
  });
  it("loads similar titles through authenticated Seerr and excludes the current title", async () => {
    vi.mocked(getCachedSeerrPage).mockResolvedValue({
      page: 1,
      totalPages: 1,
      totalResults: 3,
      results: [
        { id: 1, mediaType: "movie" },
        { id: 2, mediaType: "movie" },
        { id: 2, mediaType: "movie" },
      ],
    });
    const signal = new AbortController().signal;
    expect(await getSeerrSimilar(1, "movie", signal)).toEqual([
      { id: 2, mediaType: "movie" },
    ]);
    expect(getCachedSeerrPage).toHaveBeenCalledWith("/movie/1/similar", signal);
  });
  it("preserves Seerr availability on collection titles and supports release/rating sorting", async () => {
    vi.mocked(seerrFetch).mockResolvedValue({
      id: 5,
      name: "Films",
      parts: [
        {
          id: 1,
          title: "First",
          releaseDate: "2000-01-01",
          voteAverage: 6,
          mediaInfo: { status: 5 },
        },
        { id: 2, title: "Second", releaseDate: "2010-01-01", voteAverage: 9 },
        { id: 2, title: "Second duplicate" },
        { id: 3, title: "Unreleased" },
      ],
    });
    const collection = await getSeerrCollection(5);
    expect(collection.parts).toHaveLength(3);
    expect(collection.parts[0]).toMatchObject({
      mediaType: "movie",
      mediaInfo: { status: 5 },
    });
    expect(
      sortCollectionParts(collection.parts, "release").map((item) => item.id),
    ).toEqual([1, 2, 3]);
    expect(
      sortCollectionParts(collection.parts, "rating").map((item) => item.id),
    ).toEqual([2, 1, 3]);
    expect(seerrFetch).toHaveBeenCalledWith("/collection/5", {
      signal: undefined,
    });
  });
});
