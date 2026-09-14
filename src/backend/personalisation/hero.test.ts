// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { RankedCandidate } from "./engine";
import { recommendationHero } from "./hero";
import { TasteCandidate } from "./types";

function entry(
  id: number,
  type: "movie" | "tv" = "movie",
  popularity = 0,
): RankedCandidate<TasteCandidate> {
  return {
    candidate: {
      media: {
        key: `${id}`,
        type,
        title: `Title ${id}`,
        genres: [],
        studios: [],
      },
      popularity,
    },
    score: 10 - id,
    reason: "Test",
    seed: "test",
  };
}
describe("personalised hero mix", () => {
  it("mixes top recommendations, other-media recommendations, popularity and varied choices without duplicates", () => {
    const ranked = [
      entry(1),
      entry(2),
      entry(3),
      entry(4, "movie", 100),
      entry(5),
      entry(6),
      entry(7),
    ];
    const hero = recommendationHero(
      ranked,
      [entry(8, "tv"), entry(1)],
      () => 0.99,
    );
    expect(hero.slice(0, 4).map((item) => item.media.key)).toEqual([
      "1",
      "2",
      "8",
      "4",
    ]);
    expect(hero[4].media.key).toBe("7");
    expect(new Set(hero.map((item) => item.media.key)).size).toBe(hero.length);
    expect(hero).toHaveLength(6);
  });
  it("uses only the provided eligible source pool and handles small libraries", () => {
    const one = entry(1);
    expect(recommendationHero([one], [one])).toEqual([one.candidate]);
    expect(recommendationHero([])).toEqual([]);
  });
});
