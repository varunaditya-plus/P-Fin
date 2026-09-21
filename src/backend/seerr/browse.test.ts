// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSeerrPage, seerrFetch } from "@/backend/seerr/api";

import {
  cachedSeerrPage,
  cachedSeerrPopularPicks,
  getCachedSeerrPage,
  getSeerrPersonCredits,
  getSeerrPopularPicks,
  randomSeerrMedia,
} from "./browse";

let userId = 0;
let enabled = true;
vi.mock("@/stores/jellyfin", () => ({
  useJellyfinAuth: {
    getState: () => ({
      session: { serverUrl: "server", userId, accessToken: "test" },
    }),
  },
}));
vi.mock("@/stores/seerr", () => ({
  useSeerrConnection: {
    getState: () => ({ connection: { url: "seerr", userId } }),
  },
  matchesSeerrSession: () => enabled,
}));
vi.mock("@/backend/seerr/api", () => ({
  getSeerrPage: vi.fn(),
  seerrFetch: vi.fn(),
}));

beforeEach(() => {
  userId += 1;
  enabled = true;
  vi.resetAllMocks();
});

describe("Seerr browsing", () => {
  it("samples and shuffles a bounded popular pool without replacing the popular feed", async () => {
    vi.mocked(getSeerrPage)
      .mockResolvedValueOnce({
        page: 1,
        totalPages: 1000,
        totalResults: 20000,
        results: [{ id: 1, mediaType: "movie" }],
      })
      .mockResolvedValueOnce({
        page: 26,
        totalPages: 1000,
        totalResults: 20000,
        results: Array.from({ length: 20 }, (_, index) => ({
          id: index + 2,
          mediaType: "movie" as const,
        })),
      });
    const picks = await getSeerrPopularPicks(
      "movie",
      undefined,
      false,
      () => 0.5,
    );
    expect(getSeerrPage).toHaveBeenLastCalledWith(
      "/discover/movies?sortBy=popularity.desc&voteAverageGte=6&voteCountGte=300&page=26",
      expect.any(AbortSignal),
    );
    expect(picks.results).toHaveLength(15);
    expect(picks.results.map((item) => item.id)).not.toEqual(
      Array.from({ length: 15 }, (_, index) => index + 2),
    );
    expect(await getSeerrPopularPicks("movie")).toBe(picks);
    expect(getSeerrPage).toHaveBeenCalledTimes(2);
    userId += 1;
    expect(cachedSeerrPopularPicks("movie")).toBeUndefined();
  });
  it("caps TV pools at their available pages and reshuffles only on an explicit refresh", async () => {
    vi.mocked(getSeerrPage).mockResolvedValue({
      page: 1,
      totalPages: 1,
      totalResults: 3,
      results: [
        { id: 1, mediaType: "tv" },
        { id: 2, mediaType: "tv" },
        { id: 3, mediaType: "tv" },
      ],
    });
    const first = await getSeerrPopularPicks("tv", undefined, false, () => 0);
    const second = await getSeerrPopularPicks("tv", undefined, true, () => 0.9);
    expect(first.results).not.toEqual(second.results);
    expect(getSeerrPage).toHaveBeenCalledTimes(2);
    expect(getSeerrPage).toHaveBeenLastCalledWith(
      "/discover/tv?sortBy=popularity.desc&voteAverageGte=6&voteCountGte=150",
      expect.any(AbortSignal),
    );
  });
  it("chooses from another page rather than repeatedly sampling the first carousel", async () => {
    vi.mocked(getSeerrPage)
      .mockResolvedValueOnce({
        page: 1,
        totalPages: 1000,
        totalResults: 20000,
        results: [{ id: 1, mediaType: "movie" }],
      })
      .mockResolvedValueOnce({
        page: 251,
        totalPages: 1000,
        totalResults: 20000,
        results: [{ id: 251, mediaType: "movie" }],
      });
    await expect(
      randomSeerrMedia("movie", undefined, () => 0.5),
    ).resolves.toMatchObject({ id: 251 });
    expect(getSeerrPage).toHaveBeenLastCalledWith(
      "/discover/movies?page=251",
      expect.any(AbortSignal),
    );
  });

  it("scopes cached pages to the current connection and rechecks disabled connections", async () => {
    vi.mocked(getSeerrPage).mockResolvedValue({
      page: 1,
      totalPages: 1,
      totalResults: 1,
      results: [
        { id: 1, mediaType: "movie" },
        { id: 1, mediaType: "movie" },
      ],
    });
    expect((await getCachedSeerrPage("/discover/movies")).results).toHaveLength(
      1,
    );
    await getCachedSeerrPage("/discover/movies");
    expect(getSeerrPage).toHaveBeenCalledTimes(1);
    userId += 1;
    expect(cachedSeerrPage("/discover/movies")).toBeUndefined();
    await getCachedSeerrPage("/discover/movies");
    expect(getSeerrPage).toHaveBeenCalledTimes(2);
    enabled = false;
    expect(cachedSeerrPage("/discover/movies")).toBeUndefined();
    vi.mocked(getSeerrPage).mockRejectedValue(new Error("Seerr disabled"));
    await expect(getCachedSeerrPage("/discover/movies")).rejects.toThrow(
      "Seerr disabled",
    );
  });

  it("separates acting and directing credits without losing a TV title with the same ID", async () => {
    vi.mocked(seerrFetch).mockResolvedValue({
      cast: [
        { id: 1, mediaType: "movie", releaseDate: "2000-01-01" },
        { id: 1, mediaType: "tv", firstAirDate: "2020-01-01" },
      ],
      crew: [
        {
          id: 1,
          mediaType: "movie",
          releaseDate: "2000-01-01",
          job: "Director",
        },
        { id: 2, mediaType: "movie", job: "Producer" },
      ],
    });
    await expect(getSeerrPersonCredits(12)).resolves.toMatchObject({
      acting: [
        { id: 1, mediaType: "tv" },
        { id: 1, mediaType: "movie" },
      ],
      directing: [{ id: 1, mediaType: "movie", job: "Director" }],
    });
    expect(seerrFetch).toHaveBeenCalledWith("/person/12/combined_credits", {
      signal: undefined,
    });
  });
});
