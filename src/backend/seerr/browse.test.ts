// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSeerrPage, seerrFetch } from "@/backend/seerr/api";

import {
  cachedSeerrPage,
  getCachedSeerrPage,
  getSeerrPersonCredits,
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

  it("merges acting and directing credits without losing a TV title with the same ID", async () => {
    vi.mocked(seerrFetch).mockResolvedValue({
      cast: [
        { id: 1, mediaType: "movie", releaseDate: "2000-01-01" },
        { id: 1, mediaType: "tv", firstAirDate: "2020-01-01" },
      ],
      crew: [{ id: 1, mediaType: "movie", releaseDate: "2000-01-01" }],
    });
    await expect(getSeerrPersonCredits(12)).resolves.toMatchObject([
      { id: 1, mediaType: "tv" },
      { id: 1, mediaType: "movie" },
    ]);
    expect(seerrFetch).toHaveBeenCalledWith("/person/12/combined_credits", {
      signal: undefined,
    });
  });
});
