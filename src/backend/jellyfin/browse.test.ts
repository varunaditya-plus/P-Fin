// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JellyfinItem, jellyfinRequest } from "@/backend/jellyfin/client";

import {
  getHomeFeedPage,
  getRandomMovie,
  librarySearchScore,
  normalizeLibrarySearch,
  parseLibrarySearch,
  searchLibrary,
  uniqueLibraryItems,
} from "./browse";

let sessionId = 0;
vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({
    userId: `user-${sessionId}`,
    serverUrl: "/jellyfin",
    accessToken: "test",
  }),
  jellyfinRequest: vi.fn(),
}));

const film = (
  Id: string,
  Name: string,
  ProductionYear?: number,
): JellyfinItem => ({ Id, Name, Type: "Movie", ProductionYear });

beforeEach(() => {
  sessionId += 1;
  vi.mocked(jellyfinRequest).mockReset();
});

describe("library discovery", () => {
  it("normalises title punctuation and accents without treating a numeric title as a year", () => {
    expect(normalizeLibrarySearch("  Amélie: Life & Love  ")).toBe(
      "amelie life and love",
    );
    expect(parseLibrarySearch("Dune (2021)")).toEqual({
      title: "dune",
      year: 2021,
    });
    expect(parseLibrarySearch("1917")).toEqual({
      title: "1917",
      year: undefined,
    });
    expect(librarySearchScore(film("wrong", "Dune", 1984), "Dune 2021")).toBe(
      0,
    );
    expect(
      librarySearchScore(film("exact", "Dune", 2021), "Dune 2021"),
    ).toBeGreaterThan(
      librarySearchScore(film("sequel", "Dune Part Two", 2024), "Dune"),
    );
    expect(
      librarySearchScore(film("typo", "Interstellar"), "interstelar"),
    ).toBeGreaterThan(0);
    expect(
      librarySearchScore(film("sequel", "John Wick 2"), "John Wick"),
    ).toBeGreaterThan(0);
    expect(
      librarySearchScore(film("wrong-sequel", "John Wick 3"), "John Wick 2"),
    ).toBe(0);
  });

  it("uses server search first, bounds typo fallback, filters missing items and deduplicates", async () => {
    vi.mocked(jellyfinRequest).mockImplementation(
      async (_path, _init, query) => ({
        Items:
          query?.SearchTerm === "inte"
            ? [
                film("one", "Interstellar"),
                film("one", "Interstellar"),
                film("other", "Interview"),
                { ...film("missing", "Interstellar"), IsMissing: true },
              ]
            : [],
      }),
    );
    const result = await searchLibrary("interstelar");
    expect(result.map((item) => item.Id)).toEqual(["one"]);
    expect(vi.mocked(jellyfinRequest).mock.calls[0][2]?.SearchTerm).toBe(
      "interstelar",
    );
    expect(vi.mocked(jellyfinRequest).mock.calls.length).toBeLessThanOrEqual(3);
    const calls = vi.mocked(jellyfinRequest).mock.calls.length;
    await searchLibrary("interstelar");
    expect(vi.mocked(jellyfinRequest).mock.calls).toHaveLength(calls);
    sessionId += 1;
    await searchLibrary("interstelar");
    expect(vi.mocked(jellyfinRequest).mock.calls.length).toBeGreaterThan(calls);
  });

  it("keeps a successful direct search when optional fallback fails", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Items: [film("one", "The Matrix")] })
      .mockRejectedValue(new Error("Temporary error"));
    await expect(searchLibrary("The Matrix")).resolves.toMatchObject([
      { Id: "one" },
    ]);
  });

  it("asks the server to choose randomly from all available movies", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Items: [film("far-beyond-home", "A movie")],
    });
    await expect(getRandomMovie()).resolves.toMatchObject({
      Id: "far-beyond-home",
    });
    expect(vi.mocked(jellyfinRequest).mock.calls[0][2]).toMatchObject({
      Recursive: true,
      IncludeItemTypes: "Movie",
      IsMissing: false,
      IsVirtualItem: false,
      SortBy: "Random",
      Limit: 1,
    });
    expect(
      vi.mocked(jellyfinRequest).mock.calls[0][2]?.ParentId,
    ).toBeUndefined();
  });

  it("paginates home feeds without filtering episodes out of resume and next up", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Items: [{ Id: "episode", Name: "Episode", Type: "Episode" }],
      TotalRecordCount: 99,
    });
    const next = await getHomeFeedPage("next-up", 60);
    expect(next.FetchedCount).toBe(1);
    expect(vi.mocked(jellyfinRequest).mock.calls[0][0]).toBe("Shows/NextUp");
    expect(vi.mocked(jellyfinRequest).mock.calls[0][2]).toMatchObject({
      StartIndex: 60,
      IncludeItemTypes: undefined,
    });
    await getHomeFeedPage("favorites");
    expect(vi.mocked(jellyfinRequest).mock.calls[1][2]).toMatchObject({
      Filters: "IsFavorite",
      ParentId: undefined,
    });
    await getHomeFeedPage("movie-library", 0, "Comedy");
    expect(vi.mocked(jellyfinRequest).mock.calls[2][2]).toMatchObject({
      ParentId: "movie-library",
      Genres: "Comedy",
    });
  });

  it("deduplicates page overlap and hides virtual entries", () => {
    expect(
      uniqueLibraryItems([
        film("one", "One"),
        film("one", "One"),
        { ...film("virtual", "Virtual"), IsVirtualItem: true },
      ]),
    ).toHaveLength(1);
  });
});
