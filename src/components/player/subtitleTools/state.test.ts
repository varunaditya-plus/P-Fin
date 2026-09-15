/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it } from "vitest";

import { useJellyfinAuth } from "@/stores/jellyfin";
import { Caption } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";

import {
  applySubtitleAutoDelay,
  applySubtitleTranslation,
  restoreSubtitleTranslation,
  subtitleToolIdentity,
  useSubtitleToolState,
} from "./state";

const original: Caption = {
  id: "jellyfin-3",
  language: "eng",
  srtData: "Original track",
};
const translated: Caption = {
  ...original,
  language: "spa",
  srtData: "Translated track",
};
beforeEach(() => {
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  useJellyfinAuth.getState().setSession(null);
  useSubtitleToolState.setState({ translation: null, autoDelay: null });
  useSubtitleStore.setState({ delay: 2 });
  usePlayerStore.getState().setCaption(original);
});

describe("subtitle tool playback ownership", () => {
  it("retains the first original across multiple translations and restores it", () => {
    const identity = subtitleToolIdentity();
    expect(applySubtitleTranslation(identity, original, translated)).toBe(true);
    expect(
      applySubtitleTranslation(identity, translated, {
        ...translated,
        language: "fra",
        srtData: "Again",
      }),
    ).toBe(true);
    expect(useSubtitleToolState.getState().translation?.original).toBe(
      original,
    );
    restoreSubtitleTranslation();
    expect(usePlayerStore.getState().caption.selected).toBe(original);
  });
  it("rejects delayed work for a replacement subtitle with the same stream index", () => {
    const identity = subtitleToolIdentity();
    const next = { ...original, srtData: "Different episode" };
    usePlayerStore.getState().setCaption(next);
    expect(applySubtitleTranslation(identity, original, translated)).toBe(
      false,
    );
    expect(applySubtitleAutoDelay(identity, original, 12)).toBe(false);
    expect(usePlayerStore.getState().caption.selected).toBe(next);
    expect(useSubtitleStore.getState().delay).toBe(2);
  });
  it("clears a translation and restores automatic delay when the source changes", () => {
    const identity = subtitleToolIdentity();
    applySubtitleTranslation(identity, original, translated);
    applySubtitleAutoDelay(identity, translated, 12);
    usePlayerStore.setState((state) => {
      state.source = { type: "file", qualities: {} };
    });
    expect(useSubtitleToolState.getState()).toMatchObject({
      translation: null,
      autoDelay: null,
    });
    expect(useSubtitleStore.getState().delay).toBe(2);
    expect(applySubtitleTranslation(identity, translated, original)).toBe(
      false,
    );
  });
  it("restores the pre-auto delay on track and account changes", () => {
    applySubtitleAutoDelay(subtitleToolIdentity(), original, 12);
    usePlayerStore.getState().setCaption({ ...original, id: "jellyfin-4" });
    expect(useSubtitleStore.getState().delay).toBe(2);
    const caption = usePlayerStore.getState().caption.selected!;
    applySubtitleAutoDelay(subtitleToolIdentity(), caption, -8);
    useJellyfinAuth.getState().setSession({
      serverUrl: "/jellyfin",
      userId: "other",
      accessToken: "test",
      deviceId: "test",
      userName: "Other",
    });
    expect(useSubtitleStore.getState().delay).toBe(2);
    expect(useSubtitleToolState.getState().autoDelay).toBeNull();
  });
  it("preserves a later manual edit when the subtitle is cleared", () => {
    applySubtitleAutoDelay(subtitleToolIdentity(), original, 12);
    useSubtitleStore.getState().setDelay(6);
    usePlayerStore.getState().setCaption(null);
    expect(useSubtitleStore.getState().delay).toBe(6);
    expect(useSubtitleToolState.getState().autoDelay).toBeNull();
  });
  it("retains the original baseline across repeated auto-sync results", () => {
    const identity = subtitleToolIdentity();
    applySubtitleAutoDelay(identity, original, 12);
    applySubtitleAutoDelay(identity, original, 10);
    usePlayerStore.getState().setCaption(null);
    expect(useSubtitleStore.getState().delay).toBe(2);
  });
});
