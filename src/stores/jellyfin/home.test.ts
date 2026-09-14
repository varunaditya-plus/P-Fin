// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { JellyfinSession } from "@/stores/jellyfin";

import {
  defaultHomePreferences,
  homePreferenceScope,
  homeSectionPreferences,
  orderedHomeSections,
} from "./home";

describe("home preferences", () => {
  it("keeps layout private to each user and server but stable across login tokens", () => {
    const session = {
      serverId: "server-a",
      serverUrl: "/jellyfin",
      userId: "user-a",
      accessToken: "first",
    } as JellyfinSession;
    expect(homePreferenceScope(session)).toBe(
      homePreferenceScope({ ...session, accessToken: "second" }),
    );
    expect(homePreferenceScope(session)).not.toBe(
      homePreferenceScope({ ...session, userId: "user-b" }),
    );
    expect(homePreferenceScope(session)).not.toBe(
      homePreferenceScope({ ...session, serverId: "server-b" }),
    );
  });
  it("preserves saved order and appends new sections without unhiding sections", () => {
    const sections = [{ id: "new" }, { id: "movies" }, { id: "resume" }];
    const preferences = {
      ...defaultHomePreferences,
      order: ["removed", "resume", "movies"],
      hidden: ["movies"],
    };
    expect(
      orderedHomeSections(sections, preferences).map((section) => section.id),
    ).toEqual(["resume", "movies", "new"]);
    expect(preferences.hidden).toEqual(["movies"]);
    expect(sections[0].id).toBe("new");
  });
  it("applies section overrides independently and migrates old layouts without overrides", () => {
    const preferences = {
      ...defaultHomePreferences,
      rows: 3,
      sections: {
        favorites: { rows: 1, density: "compact" as const, editing: true },
      },
    };
    expect(homeSectionPreferences(preferences, "favorites")).toEqual({
      rows: 1,
      density: "compact",
      editing: true,
    });
    expect(homeSectionPreferences(preferences, "resume")).toEqual({
      rows: 3,
      density: "comfortable",
      editing: false,
    });
    expect(
      homeSectionPreferences(
        { ...preferences, sections: undefined },
        "favorites",
      ).rows,
    ).toBe(3);
  });
});
