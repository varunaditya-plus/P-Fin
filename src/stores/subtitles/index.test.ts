// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it } from "vitest";

import { useSubtitleStore } from ".";

const defaults = useSubtitleStore.getState();

afterEach(() => {
  useSubtitleStore.setState(defaults, true);
  localStorage.clear();
});

describe("Jellyfin subtitle preference migration", () => {
  it("bounds numeric subtitle layout values and resets the shared appearance defaults", () => {
    useSubtitleStore
      .getState()
      .updateStyling({ lineHeight: 5, verticalPosition: -2 });
    expect(useSubtitleStore.getState().styling).toMatchObject({
      lineHeight: 3,
      verticalPosition: 0,
    });
    useSubtitleStore
      .getState()
      .updateStyling({ lineHeight: NaN, verticalPosition: Infinity });
    expect(useSubtitleStore.getState().styling).toMatchObject({
      lineHeight: 3,
      verticalPosition: 0,
    });
    useSubtitleStore.getState().resetStyling();
    expect(useSubtitleStore.getState().styling).toMatchObject({
      lineHeight: 1.5,
      verticalPosition: 1,
    });
  });
  it("preserves saved appearance and timing while dropping legacy subtitle-service state", async () => {
    localStorage.setItem(
      "__MW::subtitles",
      JSON.stringify({
        version: 0,
        state: {
          styling: { color: "#ffeebb", size: 1.5 },
          delay: 0.75,
          overrideCasing: true,
          lastSync: { lastSelectedLanguage: "en" },
          isOpenSubtitles: true,
        },
      }),
    );
    await useSubtitleStore.persist.rehydrate();
    expect(useSubtitleStore.getState()).toMatchObject({
      styling: { ...defaults.styling, color: "#ffeebb", size: 1.5 },
      delay: 0.75,
      overrideCasing: true,
    });
    const stored = JSON.parse(localStorage.getItem("__MW::subtitles")!);
    expect(stored.version).toBe(1);
    expect(stored.state).not.toHaveProperty("lastSync");
    expect(stored.state).not.toHaveProperty("isOpenSubtitles");
    useSubtitleStore.getState().setDelay(1);
    expect(useSubtitleStore.getState().delay).toBe(1);
  });
});
