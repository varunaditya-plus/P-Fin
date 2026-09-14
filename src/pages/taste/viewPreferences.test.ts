// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { getAppPreferenceSections } from "@/stores/appPreferences/registry";

import { resolveTasteView } from "./viewPreferences";

describe("recommendation view choices", () => {
  it("defaults to For You only with useful signals and honours either explicit choice", () => {
    expect(resolveTasteView(null, true)).toBe(true);
    expect(resolveTasteView(null, false)).toBe(false);
    expect(resolveTasteView(false, true)).toBe(false);
    expect(resolveTasteView(true, false)).toBe(true);
  });
  it("preserves saved boolean choices and defaults unset preferences to automatic", () => {
    const section = getAppPreferenceSections().get("recommendationView");
    expect(section).toBeDefined();
    expect(
      section!.validate({ library: false, seerr: true, type: "tv" }),
    ).toEqual({ library: false, seerr: true, type: "tv" });
    expect(section!.validate({})).toEqual({
      library: null,
      seerr: null,
      type: "movie",
    });
  });
});
