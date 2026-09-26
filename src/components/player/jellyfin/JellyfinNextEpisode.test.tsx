// @vitest-environment jsdom
import { ReactNode, act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";

import { JellyfinNextEpisode } from "./JellyfinControls";

const playItem = vi.hoisted(() => vi.fn());
vi.mock("./JellyfinPlaybackContext", () => ({
  useJellyfinPlayback: () => ({
    itemId: "one",
    episodes: [{ Id: "one" }, { Id: "two" }],
    playItem,
  }),
}));
vi.mock("@/components/utils/Transition", () => ({
  Transition: ({ children }: { children: ReactNode }) => children,
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const ended = new Set<() => void>();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  playItem.mockClear();
  ended.clear();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  usePreferencesStore.setState({ enableAutoplay: true });
  usePlayerStore.setState((state) => {
    state.progress.time = 999.9;
    state.progress.duration = 1000;
    state.display = {
      on: (_: string, callback: () => void) => ended.add(callback),
      off: (_: string, callback: () => void) => ended.delete(callback),
    } as unknown as DisplayInterface;
  });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});
it("waits for actual playback end and advances only once with both buttons mounted", () => {
  act(() =>
    root.render(
      <>
        <JellyfinNextEpisode controlsShowing />
        <JellyfinNextEpisode controlsShowing compact />
      </>,
    ),
  );
  expect(playItem).not.toHaveBeenCalled();
  act(() => {
    ended.forEach((fn) => fn());
    ended.forEach((fn) => fn());
  });
  expect(playItem).toHaveBeenCalledOnce();
  expect(playItem).toHaveBeenLastCalledWith("two", true);
});
it("removes the end listener when autoplay is disabled", () => {
  act(() => root.render(<JellyfinNextEpisode controlsShowing />));
  act(() => usePreferencesStore.setState({ enableAutoplay: false }));
  expect(ended.size).toBe(0);
  expect(playItem).not.toHaveBeenCalled();
});
