// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it } from "vitest";

import "./AccountPreferencesSync";
import {
  getAppPreferenceSections,
  snapshotAppPreferences,
  validateImportedPreferences,
} from "./registry";

it("registers optional feature preferences before direct settings hydration and export", () => {
  const sections = getAppPreferenceSections();
  expect(sections.has("simklApplication")).toBe(true);
  expect(sections.has("watchlist")).toBe(false);
  expect(sections.has("subtitleTools")).toBe(true);
  expect(sections.has("recommendationView")).toBe(true);
  const exported = JSON.stringify(snapshotAppPreferences());
  expect(exported).not.toContain("accessToken");
  expect(exported).not.toContain("jellyfinToken");
});

it("imports supported settings from old backups without restoring the removed watchlist", () => {
  const legacyWatchlist = [{ title: "Saved film", key: "tmdb:movie:1" }];
  expect(
    validateImportedPreferences(
      {
        format: "movie-fin-settings",
        version: 1,
        sections: {
          watchlist: legacyWatchlist,
          simklApplication: "public-app-id",
        },
      },
      ["watchlist", "simklApplication"],
    ),
  ).toEqual({ simklApplication: "public-app-id" });
  expect(snapshotAppPreferences()).not.toHaveProperty("watchlist");
});
