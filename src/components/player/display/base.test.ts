// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeVideoElementDisplayInterface } from "./base";

vi.mock("@/utils/detectFeatures", () => ({
  canChangeVolume: async () => true,
  canFullscreen: () => false,
  canFullscreenAnyElement: () => false,
  canPictureInPicture: () => false,
  canPlayHlsNatively: () => false,
  canWebkitFullscreen: () => false,
  canWebkitPictureInPicture: () => false,
}));

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const file = {
  type: "mp4" as const,
  url: "http://localhost/jellyfin/Videos/item/stream.mp4",
};

describe("player source lifecycle", () => {
  it("keeps a paused source paused and applies resume after metadata loads", () => {
    const display = makeVideoElementDisplayInterface();
    const video = document.createElement("video");
    display.load({
      source: file,
      startAt: 123,
      autoplay: false,
      automaticQuality: false,
      preferredQuality: null,
    });
    display.processVideoElement(video);
    expect(video.autoplay).toBe(false);
    video.currentTime = 0;
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.currentTime).toBe(123);
    video.dispatchEvent(new Event("canplay"));
    expect(video.play).not.toHaveBeenCalled();
    display.destroy();
  });

  it("continues playing after a playing source is changed", () => {
    const display = makeVideoElementDisplayInterface();
    const video = document.createElement("video");
    display.processVideoElement(video);
    display.load({
      source: file,
      startAt: 42,
      autoplay: true,
      automaticQuality: false,
      preferredQuality: null,
    });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("canplay"));
    expect(video.autoplay).toBe(true);
    expect(video.play).toHaveBeenCalledOnce();
    display.destroy();
  });

  it("reports each event once after track switches and detaches events on teardown", () => {
    const display = makeVideoElementDisplayInterface();
    const video = document.createElement("video");
    const onTime = vi.fn();
    display.on("time", onTime);
    display.processVideoElement(video);
    for (let index = 0; index < 3; index += 1)
      display.load({
        source: file,
        startAt: 0,
        automaticQuality: false,
        preferredQuality: null,
      });
    video.currentTime = 10;
    video.dispatchEvent(new Event("timeupdate"));
    expect(onTime).toHaveBeenCalledOnce();
    expect(onTime).toHaveBeenLastCalledWith(10);
    display.destroy();
    video.dispatchEvent(new Event("timeupdate"));
    expect(onTime).toHaveBeenCalledOnce();
  });
  it("passes the Jellyfin source directly to the native AirPlay picker", () => {
    const display = makeVideoElementDisplayInterface();
    const video = document.createElement("video");
    const picker = vi.fn();
    Object.assign(video, { webkitShowPlaybackTargetPicker: picker });
    display.processVideoElement(video);
    display.load({
      source: file,
      startAt: 42,
      autoplay: false,
      automaticQuality: false,
      preferredQuality: null,
    });
    const originalSource = video.src;
    display.startAirplay();
    expect(picker).toHaveBeenCalledOnce();
    expect(video.src).toBe(originalSource);
    expect(video.src).toBe(file.url);
    display.destroy();
  });
  it("applies picture settings only to the video and carries them across source changes", () => {
    const display = makeVideoElementDisplayInterface();
    const video = document.createElement("video");
    display.setVideoAppearance({
      brightness: 130,
      contrast: 110,
      saturation: 90,
      hue: 10,
    });
    display.processVideoElement(video);
    expect(video.style.filter).toBe(
      "brightness(130%) contrast(110%) saturate(90%) hue-rotate(10deg)",
    );
    display.load({
      source: file,
      startAt: 0,
      autoplay: false,
      automaticQuality: true,
      preferredQuality: null,
    });
    expect(video.style.filter).toContain("brightness(130%)");
    display.setVideoAppearance({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
    });
    expect(video.style.filter).toBe("none");
    display.destroy();
  });
});

it("retains playback speed across stream replacement and video remounts", () => {
  const display = makeVideoElementDisplayInterface();
  const video = document.createElement("video");
  display.processVideoElement(video);
  display.setPlaybackRate(1.5);
  display.load({
    source: file,
    startAt: 42,
    autoplay: false,
    automaticQuality: true,
    preferredQuality: null,
  });
  expect(video.defaultPlaybackRate).toBe(1.5);
  expect(video.playbackRate).toBe(1.5);
  const replacement = document.createElement("video");
  display.processVideoElement(replacement);
  expect(replacement.playbackRate).toBe(1.5);
  display.destroy();
});
it("clears the spinner when playback recovers and when a paused video can start", () => {
  const display = makeVideoElementDisplayInterface();
  const video = document.createElement("video");
  display.processVideoElement(video);
  display.load({
    source: file,
    startAt: 0,
    autoplay: false,
    automaticQuality: true,
    preferredQuality: null,
  });
  const loading = vi.fn();
  display.on("loading", loading);
  video.dispatchEvent(new Event("waiting"));
  expect(loading).toHaveBeenLastCalledWith(true);
  video.dispatchEvent(new Event("playing"));
  expect(loading).toHaveBeenLastCalledWith(false);
  video.dispatchEvent(new Event("waiting"));
  video.dispatchEvent(new Event("canplay"));
  expect(loading).toHaveBeenLastCalledWith(false);
  display.destroy();
});
it("keeps a blocked play attempt paused without an unhandled rejection", async () => {
  const display = makeVideoElementDisplayInterface();
  const video = document.createElement("video");
  display.processVideoElement(video);
  const pause = vi.fn();
  display.on("pause", pause);
  vi.mocked(video.play).mockRejectedValueOnce(
    new DOMException("Blocked", "NotAllowedError"),
  );
  display.play();
  await vi.waitFor(() => expect(pause).toHaveBeenCalledOnce());
  display.destroy();
});
