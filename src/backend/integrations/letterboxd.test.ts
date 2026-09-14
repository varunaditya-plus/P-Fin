/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import { useIntegrationWatchlist } from "@/stores/integrations/watchlist";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { homePreferenceScope } from "@/stores/jellyfin/home";

import {
  applyLetterboxd,
  matchLibraryTitle,
  parseLetterboxdCsv,
} from "./letterboxd";

vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<object>()),
  jellyfinRequest: vi.fn(),
}));
const session = {
  serverUrl: "/jellyfin",
  serverId: "server",
  userId: "user",
  accessToken: "test",
  userName: "User",
  deviceId: "test",
};
const movieId = "a".repeat(32);
beforeEach(() => {
  vi.resetAllMocks();
  useJellyfinAuth.getState().setSession(session);
  useIntegrationWatchlist.setState({ profiles: {} });
});

describe("Letterboxd review and import", () => {
  it("reports a full watchlist as failure rather than a successful import", async () => {
    useIntegrationWatchlist.getState().merge(
      homePreferenceScope(session),
      Array.from({ length: 10000 }, (_, index) => ({
        key: `tmdb:movie:${index + 1}`,
        type: "movie",
        title: `Film ${index + 1}`,
        tmdbId: index + 1,
        addedAt: "2026-01-01T00:00:00Z",
      })),
    );
    const result = await applyLetterboxd(
      [
        {
          id: 0,
          title: "Another film",
          candidates: [],
          selected: { title: "Another film", tmdbId: 10001 },
        },
      ],
      "watchlist",
      new AbortController().signal,
      vi.fn(),
    );
    expect(result.added).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toContain("10,000 titles");
  });
  it("parses BOM, CRLF, quoted commas/newlines and escaped quotes; deduplicates title/year", () => {
    const result = parseLetterboxdCsv(
      '\uFEFFDate,Name,Year,Letterboxd URI\r\n2020-01-01,"A, ""film""\nname",2020,https://letterboxd.com/film/test/\r\n2020-01-02,"A, ""film"" name",2020,\r\n,Other,nope,',
    );
    expect(result.titles).toHaveLength(1);
    expect(result.titles[0].title).toBe('A, "film"\nname');
    expect(result.duplicates).toBe(1);
    expect(result.invalid).toBe(1);
    expect(() => parseLetterboxdCsv('Name,Year\n"bad,2001')).toThrow(
      "unclosed",
    );
  });
  it("requires exact normalised title and year and leaves multiple versions ambiguous", () => {
    const candidate = {
      Id: movieId,
      Type: "Movie",
      Name: "Amélie",
      ProductionYear: 2001,
    };
    expect(
      matchLibraryTitle({ title: "Amelie", year: 2001 }, [
        candidate,
        { ...candidate, Id: "b".repeat(32) },
      ]),
    ).toHaveLength(2);
    expect(
      matchLibraryTitle({ title: "Amelie", year: 2002 }, [candidate]),
    ).toEqual([]);
    expect(
      matchLibraryTitle({ title: "Ameli", year: 2001 }, [candidate]),
    ).toEqual([]);
  });
  it("deduplicates watchlist imports without any Jellyfin mutation or favourites", async () => {
    const row = {
      id: 0,
      title: "Film",
      candidates: [],
      selected: { title: "Film", jellyfinId: movieId, tmdbId: 10 },
    };
    const result = await applyLetterboxd(
      [row, { ...row, id: 1 }],
      "watchlist",
      new AbortController().signal,
      vi.fn(),
    );
    expect(result).toEqual({ added: 1, skipped: 1, failures: [] });
    expect(jellyfinRequest).not.toHaveBeenCalled();
    expect(
      useIntegrationWatchlist.getState().profiles[homePreferenceScope(session)],
    ).toHaveLength(1);
    useJellyfinAuth.getState().setSession({ ...session, userId: "other" });
    expect(
      useIntegrationWatchlist.getState().profiles[
        homePreferenceScope(useJellyfinAuth.getState().session)
      ],
    ).toBeUndefined();
  });
  it("skips already watched and unavailable entries and reports per-item failure", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({
        Id: movieId,
        Type: "Movie",
        UserData: { Played: true },
      })
      .mockRejectedValueOnce(new Error("Unavailable"));
    const result = await applyLetterboxd(
      [
        {
          id: 0,
          title: "Watched",
          candidates: [],
          selected: { title: "Watched", jellyfinId: movieId },
        },
        {
          id: 1,
          title: "Missing",
          candidates: [],
          selected: { title: "Missing", tmdbId: 1 },
        },
        {
          id: 2,
          title: "Failed",
          candidates: [],
          selected: { title: "Failed", jellyfinId: "b".repeat(32) },
        },
      ],
      "watched",
      new AbortController().signal,
      vi.fn(),
    );
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.failures).toEqual([
      { title: "Failed", error: "Unavailable" },
    ]);
    expect(
      vi
        .mocked(jellyfinRequest)
        .mock.calls.every(([, request]) => request?.method !== "POST"),
    ).toBe(true);
  });
  it("stops before writing when the Jellyfin account changes during a read", async () => {
    vi.mocked(jellyfinRequest).mockImplementationOnce(async () => {
      useJellyfinAuth.getState().setSession({ ...session, userId: "other" });
      return { Id: movieId, Type: "Movie", UserData: { Played: false } };
    });
    await expect(
      applyLetterboxd(
        [
          {
            id: 0,
            title: "Film",
            candidates: [],
            selected: { title: "Film", jellyfinId: movieId },
          },
        ],
        "watched",
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toThrow("account changed");
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });
});
