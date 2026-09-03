// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it } from "vitest";

import { usePreferencesStore } from ".";

const defaults = usePreferencesStore.getState();

afterEach(() => {
  usePreferencesStore.setState(defaults, true);
  localStorage.clear();
});

describe("Jellyfin preference migration", () => {
  it("keeps appearance and player choices while discarding obsolete service settings", async () => {
    localStorage.setItem(
      "__MW::preferences",
      JSON.stringify({
        version: 0,
        state: {
          enableFeatured: true,
          forceCompactEpisodeView: true,
          enableNativeSubtitles: true,
          keyboardShortcuts: { mute: { key: "N" } },
          proxyTmdb: true,
          febboxKey: "unused-service-value",
          debridToken: "unused-service-value",
          sourceOrder: ["old-provider"],
        },
      }),
    );

    await usePreferencesStore.persist.rehydrate();
    expect(usePreferencesStore.getState()).toMatchObject({
      enableFeatured: true,
      forceCompactEpisodeView: true,
      enableNativeSubtitles: true,
      keyboardShortcuts: { mute: { key: "N" } },
    });
    const stored = JSON.parse(localStorage.getItem("__MW::preferences")!);
    expect(stored.version).toBe(1);
    for (const key of [
      "proxyTmdb",
      "febboxKey",
      "debridToken",
      "sourceOrder",
    ]) {
      expect(usePreferencesStore.getState()).not.toHaveProperty(key);
      expect(stored.state).not.toHaveProperty(key);
    }
    usePreferencesStore.getState().setEnableFeatured(false);
    expect(usePreferencesStore.getState().enableFeatured).toBe(false);
  });
});
