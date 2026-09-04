// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";

import { PauseOverlay } from "./PauseOverlay";

vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: () => ({ isMobile: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const visible = () =>
  container
    .querySelector("[data-pause-overlay]")
    ?.getAttribute("aria-hidden") === "false";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  usePreferencesStore.setState({ enablePauseOverlay: true });
  usePlayerStore.setState((state) => {
    state.meta = {
      jellyfinItemId: "movie",
      title: "Movie",
      type: "movie",
      releaseYear: 2020,
    };
    state.status = playerStatus.PLAYING;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<PauseOverlay />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function advance(time: number) {
  act(() => vi.advanceTimersByTime(time));
}
function paused(value: boolean) {
  act(() =>
    usePlayerStore.setState((state) => {
      state.mediaPlaying.hasPlayedOnce = true;
      state.mediaPlaying.isPaused = value;
    }),
  );
}

describe("pause overlay timing", () => {
  it("waits for actual playback, then a continuous two-second pause", () => {
    advance(5000);
    expect(visible()).toBe(false);
    paused(true);
    advance(1999);
    expect(visible()).toBe(false);
    advance(1);
    expect(visible()).toBe(true);
    paused(false);
    expect(visible()).toBe(false);
  });

  it("cancels pending timers on resume, item changes and when disabled", () => {
    paused(true);
    advance(1000);
    paused(false);
    advance(1500);
    expect(visible()).toBe(false);
    paused(true);
    advance(2000);
    expect(visible()).toBe(true);
    act(() =>
      usePlayerStore.setState((state) => {
        state.meta!.jellyfinItemId = "other";
      }),
    );
    expect(visible()).toBe(false);
    advance(2000);
    expect(visible()).toBe(true);
    act(() => usePreferencesStore.setState({ enablePauseOverlay: false }));
    expect(visible()).toBe(false);
  });
});
