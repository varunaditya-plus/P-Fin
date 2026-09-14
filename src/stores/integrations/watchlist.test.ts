/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it } from "vitest";

import {
  WatchlistEntry,
  useIntegrationWatchlist,
  validateWatchlist,
} from "./watchlist";

const entries: WatchlistEntry[] = Array.from({ length: 10000 }, (_, index) => ({
  key: `tmdb:movie:${index + 1}`,
  type: "movie",
  title: `Film ${index + 1}`,
  tmdbId: index + 1,
  addedAt: "2026-01-01T00:00:00Z",
}));
beforeEach(() => {
  useIntegrationWatchlist.setState({ profiles: {} });
});

describe("watchlist capacity", () => {
  it("deduplicates before enforcing capacity and still updates an existing title", () => {
    const result = validateWatchlist([
      ...entries,
      { ...entries[0], title: "Updated film" },
    ]);
    expect(result).toHaveLength(10000);
    expect(result[0].title).toBe("Updated film");
  });
  it("rejects additions above capacity atomically without discarding stored entries", () => {
    useIntegrationWatchlist.getState().merge("account", entries);
    expect(() =>
      useIntegrationWatchlist
        .getState()
        .merge("account", [
          { ...entries[0], key: "tmdb:movie:10001", tmdbId: 10001 },
        ]),
    ).toThrow("10,000 titles");
    expect(useIntegrationWatchlist.getState().profiles.account).toHaveLength(
      10000,
    );
    expect(
      useIntegrationWatchlist.getState().profiles.account[9999].tmdbId,
    ).toBe(10000);
  });
});
