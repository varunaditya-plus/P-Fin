// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it } from "vitest";

import { normalizeBoostByTitle, usePlaybackEnhancements } from "./preferences";

afterEach(() => {
  usePlaybackEnhancements.setState(
    usePlaybackEnhancements.getInitialState(),
    true,
  );
  localStorage.clear();
});

describe("saved playback enhancements", () => {
  it("resets current-only boost on the next episode but remembers a series only when selected", () => {
    const preferences = usePlaybackEnhancements.getState();
    preferences.bindPlayback("episode-1", "server/user/series");
    preferences.setBoost(250);
    preferences.bindPlayback("episode-2", "server/user/series");
    expect(usePlaybackEnhancements.getState().boost).toBe(100);
    preferences.setBoost(300);
    preferences.setRememberBoost(true);
    preferences.bindPlayback("episode-3", "server/user/series");
    expect(usePlaybackEnhancements.getState().boost).toBe(300);
    preferences.bindPlayback("episode-4", "different-server/user/series");
    expect(usePlaybackEnhancements.getState().boost).toBe(100);
  });

  it("persists only picture values and remembered title settings", () => {
    const preferences = usePlaybackEnhancements.getState();
    preferences.bindPlayback("episode", "series");
    preferences.setBoost(200);
    preferences.setRememberBoost(true);
    preferences.reportBoost(200);
    const persisted = JSON.parse(
      localStorage.getItem("movie-fin-playback-enhancements")!,
    ).state;
    expect(Object.keys(persisted).sort()).toEqual(["boostByTitle", "picture"]);
    expect(persisted.boostByTitle).toEqual({ series: 200 });
    preferences.setRememberBoost(false);
    expect(usePlaybackEnhancements.getState().boostByTitle).toEqual({});
  });

  it("validates imported boost values", () => {
    expect(
      normalizeBoostByTitle({ low: -10, high: 1500, invalid: "bad", nan: NaN }),
    ).toEqual({ low: 100, high: 1000 });
  });
});
