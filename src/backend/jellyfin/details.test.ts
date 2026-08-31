// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JellyfinItem } from "./client";
import { getContentItem } from "./content";
import {
  getJellyfinDetailsId,
  getJellyfinDetailsTarget,
  resolveJellyfinDetailsItem,
} from "./details";

vi.mock("./content", () => ({ getContentItem: vi.fn() }));

const series = {
  Id: "series",
  Name: "Series",
  Type: "Series",
  Overview: "Series details",
};
const episode = {
  Id: "episode",
  Name: "Episode",
  Type: "Episode",
  SeriesId: "series",
  SeriesName: "Series",
  RunTimeTicks: 120_000_000,
};

beforeEach(() => {
  vi.mocked(getContentItem).mockReset();
});

describe("Jellyfin details routing", () => {
  it.each(["Episode", "Season"])(
    "maps a %s card to its series without carrying episode metadata",
    (type) => {
      const child = { ...episode, Type: type };
      expect(getJellyfinDetailsId(child)).toBe("series");
      expect(getJellyfinDetailsTarget(child)).toEqual({
        Id: "series",
        Type: "Series",
        Name: "Series",
      });
      expect(child.Id).toBe("episode");
    },
  );

  it("keeps movies and containers unchanged", () => {
    for (const Type of ["Movie", "Series", "BoxSet", "Playlist"]) {
      const item = { ...episode, Type };
      expect(getJellyfinDetailsId(item)).toBe("episode");
      expect(getJellyfinDetailsTarget(item)).toBe(item);
    }
  });

  it("resolves an episode deep link to full series details using the caller's signal", async () => {
    const signal = new AbortController().signal;
    vi.mocked(getContentItem)
      .mockResolvedValueOnce(episode)
      .mockResolvedValueOnce(series);
    await expect(
      resolveJellyfinDetailsItem("episode", signal),
    ).resolves.toEqual(series);
    expect(getContentItem).toHaveBeenNthCalledWith(1, "episode", signal);
    expect(getContentItem).toHaveBeenNthCalledWith(2, "series", signal);
  });

  it("loads the series directly when card metadata already identifies its parent", async () => {
    vi.mocked(getContentItem).mockResolvedValue(series);
    await expect(resolveJellyfinDetailsItem(episode)).resolves.toEqual(series);
    expect(getContentItem).toHaveBeenCalledOnce();
    expect(getContentItem).toHaveBeenCalledWith("series", undefined);
  });

  it("finds the series through season metadata when an episode omits SeriesId", async () => {
    vi.mocked(getContentItem)
      .mockResolvedValueOnce({
        Id: "episode",
        Name: "Episode",
        Type: "Episode",
        SeasonId: "season",
      })
      .mockResolvedValueOnce({
        Id: "season",
        Name: "Season",
        Type: "Season",
        SeriesId: "series",
      })
      .mockResolvedValueOnce(series);
    await expect(resolveJellyfinDetailsItem("episode")).resolves.toEqual(
      series,
    );
    expect(vi.mocked(getContentItem).mock.calls.map(([id]) => id)).toEqual([
      "episode",
      "season",
      "series",
    ]);
  });

  it.each([
    [{ Id: "episode", Name: "Orphan", Type: "Episode" }],
    [episode, { Id: "series", Name: "Wrong parent", Type: "Movie" }],
    [episode, { ...episode, Id: "series", SeriesId: "episode" }],
  ])(
    "rejects unavailable or invalid parent metadata instead of returning episode details",
    async (...items) => {
      for (const item of items)
        vi.mocked(getContentItem).mockResolvedValueOnce(item as JellyfinItem);
      await expect(resolveJellyfinDetailsItem("episode")).rejects.toThrow(
        "series for this episode or season is not available",
      );
    },
  );

  it("preserves access failures from the series endpoint", async () => {
    vi.mocked(getContentItem)
      .mockResolvedValueOnce(episode)
      .mockRejectedValueOnce(new Error("Access denied"));
    await expect(resolveJellyfinDetailsItem("episode")).rejects.toThrow(
      "Access denied",
    );
  });

  it("stops resolving when the modal selection was cancelled", async () => {
    const controller = new AbortController();
    vi.mocked(getContentItem).mockImplementationOnce(async () => {
      controller.abort();
      return episode;
    });
    await expect(
      resolveJellyfinDetailsItem("episode", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(getContentItem).toHaveBeenCalledOnce();
  });
});
