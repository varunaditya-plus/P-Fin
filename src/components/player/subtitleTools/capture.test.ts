// @vitest-environment jsdom
/* eslint-disable max-classes-per-file, class-methods-use-this */
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, expect, it, vi } from "vitest";

import { capturePlaybackAudio } from "./capture";

afterEach(() => {
  vi.unstubAllGlobals();
});
it("stops captured tracks if the recorder cannot be constructed", async () => {
  const stop = vi.fn();
  const track = { stop };
  vi.stubGlobal("MediaStream", class {});
  vi.stubGlobal(
    "MediaRecorder",
    class {
      constructor() {
        throw new Error("Unsupported codec");
      }
    },
  );
  const video = {
    paused: false,
    readyState: 3,
    playbackRate: 1,
    currentTime: 0,
    captureStream: () => ({
      getAudioTracks: () => [track],
      getTracks: () => [track],
    }),
  } as unknown as HTMLVideoElement;
  await expect(
    capturePlaybackAudio(video, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("Unsupported codec");
  expect(stop).toHaveBeenCalledTimes(1);
});
it("cancels capture without requesting microphone access or decoding audio", async () => {
  const stop = vi.fn();
  const recorderStop = vi.fn();
  const controller = new AbortController();
  vi.stubGlobal("MediaStream", class {});
  vi.stubGlobal(
    "MediaRecorder",
    class {
      state = "recording";

      start() {}

      stop() {
        recorderStop();
      }
    },
  );
  const video = {
    paused: false,
    readyState: 3,
    playbackRate: 1,
    currentTime: 0,
    captureStream: () => ({
      getAudioTracks: () => [{ stop }],
      getTracks: () => [{ stop }],
    }),
  } as unknown as HTMLVideoElement;
  const pending = capturePlaybackAudio(video, controller.signal, vi.fn());
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(recorderStop).toHaveBeenCalledTimes(1);
});
