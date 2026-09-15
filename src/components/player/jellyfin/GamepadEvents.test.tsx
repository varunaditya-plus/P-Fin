// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";
import { useGamepadStore } from "@/stores/gamepad";
import { usePlayerStore } from "@/stores/player/store";

import { GamepadEvents } from "./GamepadEvents";
import {
  JellyfinPlaybackContext,
  JellyfinPlaybackControls,
} from "./JellyfinPlaybackContext";

const open = vi.fn();
vi.mock("@/hooks/useOverlayRouter", () => ({
  useInternalOverlayRouter: () => ({
    open,
    close: vi.fn(),
    currentRoute: null,
  }),
}));
let frame: FrameRequestCallback;
let pressed: number[];
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const play = vi.fn();
const setVolume = vi.fn((value: number) =>
  usePlayerStore.setState((state) => {
    state.mediaPlaying.volume = value;
  }),
);
const playItem = vi.fn();
const cancelFrame = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frame = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  pressed = [];
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => [
      {
        index: 0,
        connected: true,
        axes: [],
        buttons: Array.from({ length: 16 }, (_, i) => ({
          pressed: pressed.includes(i),
          value: pressed.includes(i) ? 1 : 0,
        })),
      },
    ],
  });
  useGamepadStore.setState({
    enabled: true,
    mapping: { 0: "play", 1: "next", 8: "settings" },
  });
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  usePlayerStore.setState((s) => {
    s.display = { play, setVolume } as unknown as DisplayInterface;
    s.mediaPlaying.isPaused = true;
  });
  container = document.createElement("div");
  container.className = "popout-location";
  document.body.append(container);
  root = createRoot(container);
  const controls = {
    itemId: "one",
    episodes: [{ Id: "one" }, { Id: "two" }],
    playItem,
    busy: false,
  } as unknown as JellyfinPlaybackControls;
  act(() =>
    root.render(
      <MemoryRouter>
        <JellyfinPlaybackContext.Provider value={controls}>
          <GamepadEvents />
        </JellyfinPlaybackContext.Provider>
      </MemoryRouter>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useGamepadStore.setState({ enabled: false });
});

describe("mounted controller actions", () => {
  it("connects remapped play, next episode and settings actions to the current player", () => {
    pressed = [0, 1, 8];
    act(() => frame(10));
    expect(play).toHaveBeenCalledOnce();
    expect(playItem).toHaveBeenCalledWith("two", true);
    expect(open).toHaveBeenCalledOnce();
    act(() => frame(100));
    expect(playItem).toHaveBeenCalledOnce();
  });
  it("stops polling when controller support is disabled", () => {
    act(() => useGamepadStore.setState({ enabled: false }));
    expect(cancelFrame).toHaveBeenCalledWith(1);
  });
});

it("mutes and restores the previous volume through a remapped controller button", () => {
  act(() => {
    useGamepadStore.setState({ mapping: { 0: "mute" } });
    usePlayerStore.setState((state) => {
      state.mediaPlaying.volume = 0.4;
    });
  });
  pressed = [0];
  act(() => frame(10));
  expect(setVolume).toHaveBeenLastCalledWith(0);
  pressed = [];
  act(() => frame(20));
  pressed = [0];
  act(() => frame(30));
  expect(setVolume).toHaveBeenLastCalledWith(0.4);
});
