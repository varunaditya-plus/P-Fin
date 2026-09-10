// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { defaultTasteProfile } from "@/stores/taste";

import {
  buildTasteAffinities,
  nextQuizBatch,
  qualityConfidence,
  rankRecommendations,
  ratingRecency,
  recommendationRows,
} from "./engine";
import { TasteCandidate, TasteProfile, normaliseGenres } from "./types";

const now = 1_800_000_000_000;
function candidate(
  id: string,
  genres = ["Comedy"],
  type: "movie" | "tv" = "movie",
): TasteCandidate {
  return {
    media: {
      key: `jellyfin:${type}:${id}`,
      jellyfinId: id,
      type,
      title: id,
      genres,
      studios: [],
    },
  };
}
function profile(
  rating: "loved" | "liked" | "disliked" | "hated" = "loved",
  type: "movie" | "tv" = "movie",
): TasteProfile {
  const media = candidate("rated", ["Comedy"], type).media;
  return {
    ...defaultTasteProfile,
    ratings: { [media.key]: { ...media, rating, ratedAt: now } },
  };
}
describe("personal recommendations", () => {
  it("weights love above like and negative ratings below neutral, without mixing movie/TV taste", () => {
    const affinity = (rating: "loved" | "liked" | "disliked" | "hated") =>
      buildTasteAffinities(profile(rating), "movie", [], now).genres.get(
        "Comedy",
      )!;
    expect(affinity("loved")).toBeGreaterThan(affinity("liked"));
    expect(affinity("hated")).toBeLessThan(affinity("disliked"));
    expect(
      buildTasteAffinities(profile("loved", "tv"), "movie", [], now).genres
        .size,
    ).toBe(0);
    expect(normaliseGenres([10759, 10765, "Sci-Fi"])).toEqual([
      "Action",
      "Adventure",
      "Science Fiction",
      "Fantasy",
    ]);
  });
  it("softens older ratings and low-vote quality rather than trusting a lone perfect vote", () => {
    expect(ratingRecency(now - 90 * 86400000, now)).toBe(0.5);
    expect(qualityConfidence(10, 1)).toBeLessThan(qualityConfidence(8, 500));
    expect(qualityConfidence(10, 0)).toBe(6.5);
  });
  it("combines favourites, history and in-progress signals while excluding seen/rated titles", () => {
    const items = [
      candidate("new-comedy"),
      candidate("new-horror", ["Horror"]),
      { ...candidate("favourite"), favourite: true },
      { ...candidate("watched"), watched: true },
      { ...candidate("progress"), progress: true },
      candidate("rated"),
    ];
    const ranked = rankRecommendations(items, profile(), "movie", now);
    expect(ranked[0].candidate.media.genres).toContain("Comedy");
    expect(ranked.map((entry) => entry.candidate.media.title)).not.toEqual(
      expect.arrayContaining(["rated", "watched", "progress"]),
    );
    const signals = buildTasteAffinities(
      defaultTasteProfile,
      "movie",
      items,
      now,
    );
    expect(signals.genres.get("Comedy")).toBeGreaterThan(1);
  });
  it("uses genre/franchise preferences and lets alternate seeds appear before one seed overflows", () => {
    const taste = {
      ...defaultTasteProfile,
      preferences: {
        ...defaultTasteProfile.preferences,
        favoriteGenres: ["Adventure"],
        franchises: ["starwars"],
      },
    };
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...candidate(`same-${index}`, ["Adventure"]),
      relatedSeeds: [{ key: "one-seed", weight: 4 }],
    }));
    const different = {
      ...candidate("Star Wars: A New Hope", ["Adventure"]),
      voteCount: 500,
      relatedSeeds: [{ key: "other-seed", weight: 1 }],
    };
    const ranked = rankRecommendations(
      [...items, different],
      taste,
      "movie",
      now,
    );
    expect(ranked.slice(0, 4).map((entry) => entry.seed)).toContain(
      "other-seed",
    );
    expect(
      ranked.find((entry) => entry.candidate === different)?.reason,
    ).toContain("Star Wars");
  });
  it("builds relative tiers and mood rows, and refills quiz batches without repeats", () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      candidate(`item-${index}`, [index % 3 ? "Comedy" : "Drama"]),
    );
    const ranked = rankRecommendations(items, profile(), "movie", now);
    const rows = recommendationRows(ranked);
    expect(rows.map((row) => row.title)).toEqual(
      expect.arrayContaining([
        "Sure Bets",
        "Worth a Look",
        "Something New",
        "Easy Watching",
        "Heavy Hitters",
      ]),
    );
    const seen = new Set<string>();
    const first = nextQuizBatch(items, profile(), "movie", seen, () => 0.5);
    first.forEach((item) => seen.add(item.media.key));
    const second = nextQuizBatch(items, profile(), "movie", seen, () => 0.5);
    expect(first).toHaveLength(10);
    expect(second).toHaveLength(10);
    expect(second.some((item) => seen.has(item.media.key))).toBe(false);
    expect(nextQuizBatch(items, profile(), "tv", seen)).toHaveLength(0);
  });
});
