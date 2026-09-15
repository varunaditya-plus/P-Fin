// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it } from "vitest";

import "./AccountPreferencesSync";
import { getAppPreferenceSections, snapshotAppPreferences } from "./registry";

it("registers optional feature preferences before direct settings hydration and export", () => {
  const sections = getAppPreferenceSections();
  expect(sections.has("simklApplication")).toBe(true);
  expect(sections.has("watchlist")).toBe(true);
  expect(sections.has("subtitleTools")).toBe(true);
  expect(sections.has("recommendationView")).toBe(true);
  const exported = JSON.stringify(snapshotAppPreferences());
  expect(exported).not.toContain("accessToken");
  expect(exported).not.toContain("jellyfinToken");
});
