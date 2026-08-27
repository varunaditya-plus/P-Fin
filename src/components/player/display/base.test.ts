// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeVideoElementDisplayInterface } from "./base";

vi.mock("@/backend/extension/messaging", () => ({
  RULE_IDS: {},
  isExtensionActiveCached: () => false,
  setDomainRule: vi.fn(),
}));
vi.mock("@/utils/cdn", () => ({ processCdnLink: (url: string) => url }));
vi.mock("@/components/player/utils/proxy", () => ({
  createM3U8ProxyUrl: (url: string) => url,
  createMP4ProxyUrl: (url: string) => url,
  isUrlAlreadyProxied: () => false,
}));
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
});
