// @vitest-environment jsdom
import type { VideoSubtitleOptions } from "libbitsub";
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SubtitleView } from "@/components/player/base/SubtitleView";
import { DisplayInterface } from "@/components/player/display/displayInterface";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";

import { VideoContainer } from "./VideoContainer";

const bitmap = vi.hoisted(() => ({ create: vi.fn(), dispose: vi.fn() }));
vi.mock("libbitsub", () => ({
  PgsRenderer: vi.fn((options: VideoSubtitleOptions) => {
    bitmap.create(options);
    return { timeOffset: 0, dispose: bitmap.dispose };
  }),
}));
vi.mock("@/components/utils/Transition", () => ({
  Transition: ({ children }: { children: React.ReactNode }) => children,
}));
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const track = { mode: "disabled" };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:http://localhost/captions");

      static revokeObjectURL = vi.fn();
    },
  );
  Object.defineProperty(HTMLTrackElement.prototype, "track", {
    configurable: true,
    get: () => track,
  });
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  usePreferencesStore.setState({ enableNativeSubtitles: false });
  usePlayerStore.setState((state) => {
    state.display = {
      processVideoElement: vi.fn(),
      destroy: vi.fn(),
    } as unknown as DisplayInterface;
    state.source = { type: "hls", url: "/jellyfin/stream.m3u8" };
    state.status = playerStatus.PLAYING;
    state.caption.selected = {
      id: "caption",
      language: "eng",
      srtData: "1\n00:00:00,000 --> 00:00:10,000\nA subtitle\n",
    };
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <>
        <VideoContainer />
        <SubtitleView controlsShown />
      </>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  Reflect.deleteProperty(HTMLTrackElement.prototype, "track");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("switches custom captions to a native track for PiP/fullscreen and restores custom captions on return", () => {
  expect(container.querySelector("track")).toBeNull();
  expect(container.textContent).toContain("A subtitle");
  act(() => usePlayerStore.getState().setCaptionAsTrack(true));
  expect(container.querySelector("track")?.getAttribute("src")).toContain(
    "blob:",
  );
  expect(track.mode).toBe("showing");
  expect(container.textContent).not.toContain("A subtitle");
  act(() => usePlayerStore.getState().setCaptionAsTrack(false));
  expect(container.querySelector("track")).toBeNull();
  expect(container.textContent).toContain("A subtitle");
  expect(usePreferencesStore.getState().enableNativeSubtitles).toBe(false);
});

it("adds and disposes bitmap captions without remounting or reprocessing the video", async () => {
  bitmap.create.mockClear();
  bitmap.dispose.mockClear();
  const video = container.querySelector("video");
  const display = usePlayerStore.getState().display!;
  vi.mocked(display.processVideoElement).mockClear();
  await act(async () =>
    usePlayerStore.getState().setCaption({
      id: "jellyfin-5",
      type: "sup",
      url: "/subtitle.pgssub",
      language: "en",
      srtData: "",
    }),
  );
  expect(bitmap.create).toHaveBeenCalledOnce();
  expect(bitmap.create).toHaveBeenCalledWith(
    expect.objectContaining({
      video,
      subUrl: "/subtitle.pgssub",
      streamingLoad: true,
    }),
  );
  expect(container.querySelector("canvas")).not.toBeNull();
  expect(container.querySelector("video")).toBe(video);
  expect(display.processVideoElement).not.toHaveBeenCalled();
  act(() => usePlayerStore.getState().setCaption(null));
  expect(bitmap.dispose).toHaveBeenCalledOnce();
  expect(container.querySelector("canvas")).toBeNull();
  expect(container.querySelector("video")).toBe(video);
});
