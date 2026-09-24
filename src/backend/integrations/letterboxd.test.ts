/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import { useJellyfinAuth } from "@/stores/jellyfin";

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
});

describe("Letterboxd review and import", () => {
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
          selected: { title: "Missing" },
        },
        {
          id: 2,
          title: "Failed",
          candidates: [],
          selected: { title: "Failed", jellyfinId: "b".repeat(32) },
        },
      ],
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
  it("marks only selected accessible films watched and reports progress", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({
        Id: movieId,
        Type: "Movie",
        UserData: { Played: false },
      })
      .mockResolvedValueOnce(undefined);
    const progress = vi.fn();
    const signal = new AbortController().signal;
    const result = await applyLetterboxd(
      [
        {
          id: 0,
          title: "Film",
          candidates: [],
          selected: { title: "Film", jellyfinId: movieId },
        },
        { id: 1, title: "Skipped", candidates: [] },
      ],
      signal,
      progress,
    );
    expect(result).toEqual({ added: 1, skipped: 1, failures: [] });
    expect(jellyfinRequest).toHaveBeenNthCalledWith(
      2,
      `Users/${session.userId}/PlayedItems/${movieId}`,
      { method: "POST", signal },
    );
    expect(progress.mock.calls).toEqual([[1], [2]]);
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
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toThrow("account changed");
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });
});
