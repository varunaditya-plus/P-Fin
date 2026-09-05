// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { episodeQueue, matchesEpisode } from "./episodeQueue";

const episodes = Array.from({ length: 12 }, (_, i) => ({
  Id: `episode-${i}`,
  Type: "Episode",
  Name: `Episode ${i + 1}`,
  ParentIndexNumber: 2,
  IndexNumber: i + 1,
}));
describe("series episode queue", () => {
  it("keeps a stable shuffled queue without duplicates or missing episodes", () => {
    const queue = episodeQueue(
      [
        ...episodes,
        episodes[0],
        { ...episodes[0], Id: "missing", IsMissing: true },
      ],
      "ab19",
    );
    expect(queue).toHaveLength(12);
    expect(queue).not.toEqual(episodes);
    expect(episodeQueue([...episodes].reverse(), "ab19")).toEqual(queue);
    expect(episodeQueue(episodes, "invalid")).toEqual(episodes);
  });
  it("finds episodes by exact number, season reference or title", () => {
    expect(matchesEpisode(episodes[2], "S2E3")).toBe(true);
    expect(matchesEpisode(episodes[2], "3")).toBe(true);
    expect(matchesEpisode(episodes[2], "S1E3")).toBe(false);
    expect(matchesEpisode(episodes[2], "Episode 3")).toBe(true);
  });
});
