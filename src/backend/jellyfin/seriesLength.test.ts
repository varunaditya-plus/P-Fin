// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JellyfinItem, jellyfinRequest } from "@/backend/jellyfin/client";

import { aggregateSeriesLengths, getSeriesLengthPage } from "./seriesLength";

let userId = 0;
vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({
    userId: String(userId),
    serverUrl: "server",
    accessToken: "test",
  }),
  jellyfinRequest: vi.fn(),
}));
beforeEach(() => {
  userId += 1;
  vi.resetAllMocks();
});

describe("series length", () => {
  it("sums available episode runtimes once and excludes virtual or missing episodes", () => {
    const series = [{ Id: "one", Name: "One", Type: "Series" }];
    const episodes = [
      { Id: "a", SeriesId: "one", RunTimeTicks: 100 },
      { Id: "a", SeriesId: "one", RunTimeTicks: 100 },
      { Id: "b", SeriesId: "one", RunTimeTicks: 200 },
      { Id: "missing", SeriesId: "one", RunTimeTicks: 900, IsMissing: true },
      {
        Id: "virtual",
        SeriesId: "one",
        RunTimeTicks: 900,
        IsVirtualItem: true,
      },
    ] as JellyfinItem[];
    expect(aggregateSeriesLengths(series, episodes)[0]).toMatchObject({
      TotalSeriesRunTimeTicks: 300,
      AvailableEpisodeCount: 2,
    });
  });
  it("fetches beyond the first episode page before ranking the complete series result", async () => {
    vi.mocked(jellyfinRequest).mockImplementation(
      async (_path, _init, query) => {
        if (query?.IncludeItemTypes === "Series")
          return {
            Items: [
              { Id: "short", Name: "Short", Type: "Series" },
              { Id: "long", Name: "Long", Type: "Series" },
            ],
            TotalRecordCount: 2,
          };
        if (query?.StartIndex === 0)
          return {
            Items: Array.from({ length: 500 }, (_, index) => ({
              Id: `episode-${index}`,
              SeriesId: "short",
              RunTimeTicks: 1,
            })),
            TotalRecordCount: 501,
          };
        return {
          Items: [{ Id: "last", SeriesId: "long", RunTimeTicks: 900 }],
          TotalRecordCount: 501,
        };
      },
    );
    const result = await getSeriesLengthPage("shows", {
      sortOrder: "Descending",
      status: "IsUnplayed",
      genre: "Drama",
    });
    expect(result.Items.map((item) => item.Id)).toEqual(["long", "short"]);
    expect(result.Items[0].TotalSeriesRunTimeTicks).toBe(900);
    const calls = vi.mocked(jellyfinRequest).mock.calls;
    expect(
      calls.find((call) => call[2]?.IncludeItemTypes === "Series")?.[2],
    ).toMatchObject({ Filters: "IsUnplayed", Genres: "Drama" });
    expect(
      calls
        .filter((call) => call[2]?.IncludeItemTypes === "Episode")
        .every((call) => call[2]?.Filters === undefined),
    ).toBe(true);
    const count = calls.length;
    await getSeriesLengthPage("shows", {
      sortOrder: "Ascending",
      status: "IsUnplayed",
      genre: "Drama",
    });
    expect(jellyfinRequest).toHaveBeenCalledTimes(count);
  });
});
