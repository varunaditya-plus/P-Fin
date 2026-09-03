// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";

import { usePlayerStore } from "./store";

afterEach(() => {
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
});

describe("player reset", () => {
  it("unloads media and clears source, captions and progress before the next Jellyfin item", () => {
    const load = vi.fn();
    usePlayerStore.setState((state) => {
      state.display = { load } as unknown as DisplayInterface;
    });
    const store = usePlayerStore.getState();
    store.setMeta({
      jellyfinItemId: "movie",
      type: "movie",
      title: "Movie",
      releaseYear: 2020,
    });
    store.setSource(
      { type: "hls", url: "/jellyfin/stream.m3u8" },
      [{ id: "jellyfin-4", url: "/jellyfin/subtitle", language: "eng" }],
      60,
      false,
    );
    store.setCaption({
      id: "jellyfin-4",
      language: "eng",
      srtData: "A caption",
    });
    usePlayerStore.setState((state) => {
      state.progress.time = 100;
      state.progress.duration = 200;
      state.progress.buffered = 120;
      state.mediaPlaying.hasPlayedOnce = true;
      state.mediaPlaying.isPlaying = true;
    });
    store.reset();
    expect(load).toHaveBeenLastCalledWith({
      source: null,
      startAt: 0,
      automaticQuality: false,
      preferredQuality: null,
    });
    const reset = usePlayerStore.getState();
    expect(reset.source).toBeNull();
    expect(reset.meta).toBeNull();
    expect(reset.caption.selected).toBeNull();
    expect(reset.captionList).toEqual([]);
    expect(reset.progress).toMatchObject({ time: 0, duration: 0, buffered: 0 });
    expect(reset.mediaPlaying).toMatchObject({
      isPaused: true,
      isPlaying: false,
      hasPlayedOnce: false,
    });
  });
});
