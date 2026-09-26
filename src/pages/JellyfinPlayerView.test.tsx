// @vitest-environment jsdom
import { ReactNode, act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { downloadCaption } from "@/backend/helpers/subs";
import { getItem } from "@/backend/jellyfin/client";
import {
  JellyfinPlayback,
  getPlayback,
  stopTranscode,
} from "@/backend/jellyfin/playback";
import { getUserConfiguration } from "@/backend/jellyfin/preferences";
import {
  JellyfinPlaybackControls,
  useJellyfinPlayback,
} from "@/components/player/jellyfin/JellyfinPlaybackContext";
import { playerStatus } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { useSubtitleStore } from "@/stores/subtitles";

import { JellyfinPlayerView } from "./JellyfinPlayerView";

vi.mock("@/backend/helpers/subs", () => ({ downloadCaption: vi.fn() }));
vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/client")>()),
  getItem: vi.fn(),
  getImageUrl: () => undefined,
  jellyfinUrl: (path: string) => path,
}));
vi.mock("@/backend/jellyfin/preferences", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/preferences")>()),
  getUserConfiguration: vi.fn(),
}));
vi.mock("@/backend/jellyfin/playback", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/playback")>()),
  getPlayback: vi.fn(),
  reportPlayback: vi.fn(async () => {}),
  stopTranscode: vi.fn(async () => {}),
}));
vi.mock("@/components/player/remote/JellyfinChromecast", () => ({
  JellyfinChromecastProvider: ({ children }: { children: ReactNode }) =>
    children,
}));
vi.mock("@/components/player/remote/JellyfinSyncPlay", () => ({
  JellyfinSyncPlayProvider: ({ children }: { children: ReactNode }) => children,
}));
let controls: JellyfinPlaybackControls;
let navigate: ReturnType<typeof useNavigate>;
vi.mock("@/pages/parts/player/PlayerPart", () => ({
  PlayerPart: ({ children }: { children: ReactNode }) => {
    controls = useJellyfinPlayback();
    navigate = useNavigate();
    return children;
  },
}));

const source = {
  Id: "source",
  DefaultAudioStreamIndex: 1,
  MediaStreams: [
    { Index: 1, Type: "Audio", IsDefault: true, Language: "eng" },
    { Index: 2, Type: "Audio", Language: "spa" },
    { Index: 3, Type: "Subtitle", Codec: "subrip", Language: "eng" },
    { Index: 4, Type: "Subtitle", Codec: "subrip", Language: "spa" },
    { Index: 5, Type: "Subtitle", Codec: "PGSSUB", Language: "eng" },
    { Index: 6, Type: "Subtitle", Codec: "dvdsub", Language: "eng" },
  ],
};
const playback: JellyfinPlayback = {
  itemId: "item",
  playSessionId: "session",
  mediaSource: source,
  source: { type: "hls", url: "/stream.m3u8" },
  audioIndex: 1,
  subtitleIndex: -1,
  playMethod: "DirectStream",
  captions: [3, 4, 5].map((id) => ({
    id: `jellyfin-${id}`,
    type: id === 5 ? "sup" : "vtt",
    url: `/subtitle-${id}`,
    language: "en",
  })),
};
const srtData = "1\n00:00:01,000 --> 00:00:03,000\nSubtitle\n";
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let setSource: ReturnType<
  typeof vi.fn<
    Parameters<ReturnType<typeof usePlayerStore.getState>["setSource"]>,
    void
  >
>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  useSubtitleStore.getState().setSubtitle(false);
  setSource = vi.fn((stream, captions, startAt) =>
    usePlayerStore.setState((state) => {
      state.source = stream;
      state.captionList = captions;
      state.progress.time = startAt;
      state.status = playerStatus.PLAYING;
    }),
  );
  usePlayerStore.setState({ setSource });
  vi.mocked(getItem).mockResolvedValue({
    Id: "item",
    Name: "Movie",
    Type: "Movie",
    RunTimeTicks: 1000_0000000,
    MediaSources: [source],
  });
  vi.mocked(getUserConfiguration).mockResolvedValue({ SubtitleMode: "None" });
  vi.mocked(getPlayback).mockImplementation(async (_, options) => ({
    ...playback,
    audioIndex: options?.audioIndex ?? 1,
    subtitleIndex: options?.subtitleIndex ?? -1,
  }));
  vi.mocked(downloadCaption).mockResolvedValue(srtData);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mount(query = "") {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[`/play/item${query}`]}>
        <Routes>
          <Route path="/play/:itemId" element={<JellyfinPlayerView />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  act(() =>
    usePlayerStore.setState((state) => {
      state.progress.time = 240;
      state.mediaPlaying.hasPlayedOnce = true;
      state.mediaPlaying.isPaused = false;
    }),
  );
}
async function select(index: number) {
  await act(async () => controls.changeSubtitle(index));
}

it("switches text, PGS and Off without replacing playback or losing position", async () => {
  await mount();
  for (const index of [3, 4, 5, -1]) {
    await select(index);
    expect(controls.subtitleIndex).toBe(index);
    expect(usePlayerStore.getState().progress.time).toBe(240);
    expect(usePlayerStore.getState().mediaPlaying.isPaused).toBe(false);
  }
  expect(setSource).toHaveBeenCalledOnce();
  expect(getPlayback).toHaveBeenCalledOnce();
  expect(downloadCaption).toHaveBeenCalledTimes(2);
  expect(usePlayerStore.getState().caption.selected).toBeNull();
  expect(useSubtitleStore.getState().enabled).toBe(false);
});
it("does not restart for the current audio, quality, subtitle or menu navigation", async () => {
  await mount();
  await select(5);
  await act(async () => {
    controls.changeAudio(1);
    controls.changeQuality(120_000_000);
    controls.changeSubtitle(5);
    navigate("?r=/settings/captions");
  });
  expect(getPlayback).toHaveBeenCalledOnce();
  expect(setSource).toHaveBeenCalledOnce();
});
it("keeps the previous subtitle and video when another subtitle download fails", async () => {
  await mount();
  await select(3);
  const previous = usePlayerStore.getState().caption.selected;
  vi.mocked(downloadCaption).mockRejectedValueOnce(new Error("network failed"));
  await select(4);
  expect(usePlayerStore.getState().caption.selected).toBe(previous);
  expect(controls.subtitleIndex).toBe(3);
  expect(container.textContent).toContain("Could not load this subtitle track");
  expect(container.textContent).not.toContain("Unable to play");
  expect(usePlayerStore.getState().status).toBe(playerStatus.PLAYING);
  await select(4);
  expect(controls.subtitleIndex).toBe(4);
  expect(getPlayback).toHaveBeenCalledOnce();
});
it("keeps initial playback usable when the preferred subtitle cannot download", async () => {
  vi.mocked(downloadCaption).mockRejectedValue(new Error("unavailable"));
  await mount("?subtitleIndex=3");
  expect(usePlayerStore.getState().status).toBe(playerStatus.PLAYING);
  expect(controls.busy).toBe(false);
  expect(controls.subtitleIndex).toBe(-1);
  expect(container.textContent).not.toContain("Unable to play");
});
it("ignores a late subtitle response after Off or a newer selection", async () => {
  await mount();
  let finish!: (value: string) => void;
  vi.mocked(downloadCaption).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => controls.changeSubtitle(3));
  await select(-1);
  await act(async () => finish(srtData));
  expect(usePlayerStore.getState().caption.selected).toBeNull();
  expect(controls.subtitleIndex).toBe(-1);
  expect(container.textContent).not.toContain("Could not load");
});
it("renders an initially selected PGS track locally", async () => {
  await mount("?subtitleIndex=5");
  expect(getPlayback).toHaveBeenCalledWith(
    "item",
    expect.objectContaining({ subtitleIndex: -1 }),
  );
  expect(usePlayerStore.getState().caption.selected).toMatchObject({
    id: "jellyfin-5",
    type: "sup",
  });
  expect(downloadCaption).not.toHaveBeenCalled();
});
it("replaces the stream only for unsupported image formats and preserves paused position", async () => {
  await mount();
  act(() =>
    usePlayerStore.setState((state) => {
      state.mediaPlaying.isPaused = true;
    }),
  );
  await select(6);
  expect(getPlayback).toHaveBeenLastCalledWith(
    "item",
    expect.objectContaining({ subtitleIndex: 6 }),
  );
  expect(setSource).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    240,
    false,
  );
  await select(-1);
  expect(getPlayback).toHaveBeenLastCalledWith(
    "item",
    expect.objectContaining({ subtitleIndex: -1 }),
  );
});
it("uses burn-in for PGS in video-only PiP and returns to local rendering once", async () => {
  await mount();
  await select(5);
  await act(async () => usePlayerStore.getState().setCaptionAsTrack(true));
  expect(getPlayback).toHaveBeenCalledTimes(2);
  expect(getPlayback).toHaveBeenLastCalledWith(
    "item",
    expect.objectContaining({ subtitleIndex: 5 }),
  );
  await act(async () => usePlayerStore.getState().setCaptionAsTrack(false));
  expect(getPlayback).toHaveBeenCalledTimes(3);
  expect(getPlayback).toHaveBeenLastCalledWith(
    "item",
    expect.objectContaining({ subtitleIndex: -1 }),
  );
});
it("takes the latest position when a replacement stream is ready", async () => {
  await mount();
  let finish!: (value: JellyfinPlayback) => void;
  vi.mocked(getPlayback).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => controls.changeAudio(2));
  act(() =>
    usePlayerStore.setState((state) => {
      state.progress.time = 246;
      state.mediaPlaying.isPaused = true;
    }),
  );
  await act(async () => finish({ ...playback, audioIndex: 2 }));
  expect(setSource).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    246,
    false,
  );
});
it("stops an obsolete transcode returned after the player was closed", async () => {
  await mount();
  let finish!: (value: JellyfinPlayback) => void;
  vi.mocked(getPlayback).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => controls.changeAudio(2));
  act(() => root.unmount());
  root = createRoot(container);
  const obsolete = { ...playback, playSessionId: "obsolete" };
  await act(async () => finish(obsolete));
  expect(stopTranscode).toHaveBeenCalledWith(obsolete);
  expect(setSource).toHaveBeenCalledOnce();
});
