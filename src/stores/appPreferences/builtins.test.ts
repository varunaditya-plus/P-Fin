// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { usePlaybackEnhancements } from "@/components/player/enhancements/preferences";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { usePreferencesStore } from "@/stores/preferences";
import { useSubtitleStore } from "@/stores/subtitles";

import {
  applyAccountBoosts,
  clientPreferenceSnapshot,
  currentAccountBoosts,
  validateClientPreferences,
  validateHomePreferences,
  validateSubtitlePreferences,
} from "./builtins";

describe("validated app preference groups", () => {
  it("exports only current-account title boosts and preserves other accounts on import", () => {
    useJellyfinAuth.setState({
      session: {
        serverUrl: "/jellyfin",
        serverId: "library",
        userId: "one",
        accessToken: "test",
        userName: "User",
        deviceId: "test",
      },
    });
    const own = JSON.stringify(["library", "one", "title"]);
    const other = JSON.stringify(["library", "two", "title"]);
    usePlaybackEnhancements.setState({
      boostByTitle: { [own]: 150, [other]: 200 },
      activeTitle: own,
    });
    expect(currentAccountBoosts()).toEqual({ title: 150 });
    applyAccountBoosts({ title: 250 });
    expect(usePlaybackEnhancements.getState().boostByTitle).toEqual({
      [own]: 250,
      [other]: 200,
    });
    expect(usePlaybackEnhancements.getState().boost).toBe(250);
    useJellyfinAuth.setState({ session: null });
  });
  it("drops unsafe and Jellyfin-managed fields and preserves locked shortcuts", () => {
    const checked = validateClientPreferences({
      ...clientPreferenceSnapshot(usePreferencesStore.getInitialState()),
      accessToken: "excluded",
      enableLowPerformanceMode: true,
      enableAutoplay: true,
      keyboardShortcuts: {
        skipForward5: { key: "X" },
        mute: { modifier: "Shift", key: "M" },
      },
    });
    expect(checked).not.toHaveProperty("accessToken");
    expect(checked).not.toHaveProperty("enableAutoplay");
    expect(checked.keyboardShortcuts.skipForward5.key).toBe("ArrowRight");
    expect(checked.keyboardShortcuts.mute).toEqual({
      modifier: "Shift",
      key: "M",
    });
    expect(() =>
      validateClientPreferences({ enableHoldToBoost: "yes" }),
    ).toThrow("Invalid");
  });
  it("validates subtitle appearance and excludes episode-specific selections and delay", () => {
    const input = {
      styling: {
        ...useSubtitleStore.getInitialState().styling,
        lineHeight: 1.6,
        verticalPosition: 20,
      },
      overrideCasing: true,
      delay: 42,
      lastSelectedSubtitleId: "episode",
    };
    expect(validateSubtitlePreferences(input)).toEqual({
      styling: input.styling,
      overrideCasing: true,
    });
    expect(
      validateSubtitlePreferences({
        ...input,
        styling: { ...input.styling, color: "#10B239FF" },
      }).styling.color,
    ).toBe("#10b239ff");
    expect(() =>
      validateSubtitlePreferences({
        ...input,
        styling: { ...input.styling, lineHeight: 3.1 },
      }),
    ).toThrow("lineHeight");
    expect(() =>
      validateSubtitlePreferences({
        ...input,
        styling: { ...input.styling, verticalPosition: 21 },
      }),
    ).toThrow("verticalPosition");
  });
  it("round-trips customised subtitle spacing and corners through backup validation", () => {
    const preferences = {
      styling: {
        ...useSubtitleStore.getInitialState().styling,
        lineHeight: 2.1,
        verticalPosition: 12,
        letterSpacing: -1.4,
        backgroundRadius: 11,
      },
      overrideCasing: false,
    };
    const backup = JSON.stringify(validateSubtitlePreferences(preferences));
    expect(validateSubtitlePreferences(JSON.parse(backup))).toEqual(
      preferences,
    );
  });
  it.each([
    ["letterSpacing", -2.1],
    ["letterSpacing", 8.1],
    ["letterSpacing", Infinity],
    ["letterSpacing", "2"],
    ["backgroundRadius", -1],
    ["backgroundRadius", 17],
    ["backgroundRadius", NaN],
    ["backgroundRadius", null],
  ])("rejects invalid subtitle %s values (%s)", (key, value) => {
    expect(() =>
      validateSubtitlePreferences({
        styling: {
          ...useSubtitleStore.getInitialState().styling,
          [key]: value,
        },
        overrideCasing: false,
      }),
    ).toThrow(key);
  });
  it("restores old subtitle backups with new defaults while preserving their existing appearance", () => {
    const {
      letterSpacing: _spacing,
      backgroundRadius: _radius,
      ...oldStyling
    } = useSubtitleStore.getInitialState().styling;
    const restored = validateSubtitlePreferences({
      styling: { ...oldStyling, lineHeight: 2.8, verticalPosition: 15 },
      overrideCasing: true,
    });
    expect(restored).toEqual({
      styling: {
        ...oldStyling,
        lineHeight: 2.8,
        verticalPosition: 15,
        letterSpacing: 0,
        backgroundRadius: 4,
      },
      overrideCasing: true,
    });
  });
  it("validates library ordering and layout without exporting other profiles", () => {
    expect(
      validateHomePreferences({
        order: ["latest", "latest"],
        hidden: ["resume"],
        layout: "grid",
        density: "compact",
        rows: 3,
        profiles: { other: {} },
      }),
    ).toEqual({
      order: ["latest"],
      hidden: ["resume"],
      layout: "grid",
      density: "compact",
      rows: 3,
      sections: {},
    });
    expect(() =>
      validateHomePreferences({
        order: [],
        hidden: [],
        layout: "grid",
        density: "compact",
        rows: 11,
      }),
    ).toThrow("layout");
  });
  it("validates per-section layout and edit state while retaining legacy global defaults", () => {
    const source = {
      order: [],
      hidden: [],
      layout: "grid",
      density: "comfortable",
      rows: 2,
      sections: {
        favorites: {
          rows: 4,
          density: "compact",
          editing: true,
          unknown: "drop",
        },
      },
    };
    expect(validateHomePreferences(source).sections).toEqual({
      favorites: { rows: 4, density: "compact", editing: true },
    });
    expect(() =>
      validateHomePreferences({
        ...source,
        sections: { favorites: { rows: 11 } },
      }),
    ).toThrow("section");
    expect(() =>
      validateHomePreferences({
        ...source,
        sections: { favorites: { editing: "yes" } },
      }),
    ).toThrow("section");
  });
});
