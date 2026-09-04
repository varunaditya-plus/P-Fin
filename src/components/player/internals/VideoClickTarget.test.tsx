// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";

import { VideoClickTarget } from "./VideoClickTarget";

vi.mock("./VideoContainer", () => ({ useShouldShowVideoElement: () => true }));

const pause = vi.fn();
const fullscreen = vi.fn();
const seek = vi.fn();
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  usePlayerStore.setState((s) => {
    s.display = {
      pause,
      toggleFullscreen: fullscreen,
      setTime: seek,
    } as unknown as DisplayInterface;
    s.mediaPlaying.isPaused = false;
    s.progress.time = 60;
  });
  usePreferencesStore.setState({
    enableDoubleClickToSeek: false,
    enableHoldToBoost: false,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<VideoClickTarget showingControls />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function tap(x = 0) {
  const target = container.lastElementChild as HTMLElement;
  const event = new MouseEvent("pointerup", {
    bubbles: true,
    button: 0,
    clientX: x,
  });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  target.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
  act(() => target.dispatchEvent(event));
}

describe("player tap arbitration", () => {
  it("waits for a possible double click before pausing once", () => {
    tap();
    expect(pause).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(pause).toHaveBeenCalledOnce();
  });

  it("double clicks fullscreen without also pausing", () => {
    tap();
    act(() => vi.advanceTimersByTime(100));
    tap();
    act(() => vi.advanceTimersByTime(250));
    expect(fullscreen).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
  });

  it("double taps seek without pausing when edge seeking is enabled", () => {
    act(() => usePreferencesStore.setState({ enableDoubleClickToSeek: true }));
    tap(290);
    tap(290);
    act(() => vi.advanceTimersByTime(250));
    expect(seek).toHaveBeenCalledWith(70);
    expect(pause).not.toHaveBeenCalled();
  });

  it("cancels a pending tap when the player unmounts", () => {
    tap();
    act(() => root.unmount());
    root = createRoot(container);
    act(() => vi.advanceTimersByTime(500));
    expect(pause).not.toHaveBeenCalled();
  });
});
