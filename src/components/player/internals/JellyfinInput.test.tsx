// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DisplayInterface } from "@/components/player/display/displayInterface";
import {
  JellyfinPlaybackContext,
  JellyfinPlaybackControls,
} from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";

import { KeyboardEvents } from "./KeyboardEvents";
import { MediaSession } from "./MediaSession";

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let controls: JellyfinPlaybackControls;
const play = vi.fn();
const pause = vi.fn();
const setTime = vi.fn();
const setVolume = vi.fn();
const actions = new Map<string, (() => void) | null>();
const mediaSession = {
  playbackState: "none",
  metadata: null,
  setPositionState: vi.fn(),
  setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
    actions.set(action, handler);
  }),
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("MediaMetadata", class {});
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: mediaSession,
  });
  vi.clearAllMocks();
  actions.clear();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  usePreferencesStore.setState({
    keyboardShortcuts: {},
    enableHoldToBoost: false,
  });
  usePlayerStore.setState((state) => {
    state.display = {
      play,
      pause,
      setTime,
      setVolume,
    } as unknown as DisplayInterface;
    state.meta = {
      jellyfinItemId: "episode-two",
      type: "show",
      title: "Series",
      releaseYear: 2020,
      episode: { number: 8, title: "Episode" },
      season: { number: 1, title: "Season" },
    };
    state.progress.time = 100;
    state.progress.duration = 1000;
  });
  controls = {
    playback: null,
    mediaSources: [],
    episodes: [
      { Id: "episode-one", Name: "First", Type: "Episode", IndexNumber: 2 },
      { Id: "episode-two", Name: "Second", Type: "Episode", IndexNumber: 8 },
      {
        Id: "episode-three",
        Name: "Third",
        Type: "Episode",
        ParentIndexNumber: 2,
        IndexNumber: 1,
      },
    ],
    itemId: "episode-two",
    busy: false,
    subtitleIndex: -1,
    maxBitrate: 120_000_000,
    playItem: vi.fn(),
    changeAudio: vi.fn(),
    changeSource: vi.fn(),
    changeSubtitle: vi.fn(),
    changeQuality: vi.fn(),
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  vi.unstubAllGlobals();
});

function render() {
  act(() =>
    root.render(
      <MemoryRouter>
        <JellyfinPlaybackContext.Provider value={controls}>
          <KeyboardEvents />
          <MediaSession />
        </JellyfinPlaybackContext.Provider>
      </MemoryRouter>,
    ),
  );
}

function key(value: string) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true }),
    );
  });
}

describe("Jellyfin player input", () => {
  it("navigates the Jellyfin episode order using keyboard and media-session controls", () => {
    render();
    key("p");
    key("o");
    expect(controls.playItem).toHaveBeenNthCalledWith(1, "episode-three", true);
    expect(controls.playItem).toHaveBeenNthCalledWith(2, "episode-one");
    actions.get("nexttrack")?.();
    actions.get("previoustrack")?.();
    expect(controls.playItem).toHaveBeenNthCalledWith(3, "episode-three", true);
    expect(controls.playItem).toHaveBeenNthCalledWith(4, "episode-one", false);
  });

  it("keeps play, seek, fullscreen and subtitle shortcuts attached to the current player", () => {
    const toggleFullscreen = vi.fn();
    usePlayerStore.setState((state) => {
      state.display!.toggleFullscreen = toggleFullscreen;
    });
    controls.subtitleIndex = 4;
    render();
    key("k");
    key("ArrowRight");
    key("f");
    key("c");
    expect(play).toHaveBeenCalledOnce();
    expect(setTime).toHaveBeenCalledWith(105);
    expect(toggleFullscreen).toHaveBeenCalledOnce();
    expect(controls.changeSubtitle).toHaveBeenCalledWith(-1);
  });

  it("removes media-session actions when the player leaves and disables nonexistent adjacent episodes", () => {
    controls.itemId = "episode-three";
    render();
    expect(actions.get("nexttrack")).toBeNull();
    expect(actions.get("previoustrack")).toBeTypeOf("function");
    act(() => root.unmount());
    root = createRoot(container);
    expect([...actions.values()].every((handler) => handler === null)).toBe(
      true,
    );
    key("p");
    expect(controls.playItem).not.toHaveBeenCalled();
  });
});
