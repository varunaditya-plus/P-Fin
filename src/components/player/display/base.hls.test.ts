// @vitest-environment jsdom
import Hls from "hls.js";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeVideoElementDisplayInterface } from "./base";

interface TestHls {
  levels: { width?: number; height?: number; bitrate?: number }[];
  currentLevel: number;
  loadLevel: number;
  startLevel: number;
  handlers: Map<string, () => void>;
}

vi.mock("hls.js", () => ({
  default: class {
    static instances: TestHls[] = [];

    static Events = {
      ERROR: "error",
      MANIFEST_LOADED: "loaded",
      LEVEL_SWITCHED: "switched",
    };

    static isSupported() {
      return true;
    }

    levels = [];

    currentLevel = -1;

    loadLevel = -1;

    startLevel = -1;

    handlers = new Map();

    constructor() {
      (
        this.constructor as typeof Hls & { instances: TestHls[] }
      ).instances.push(this);
    }

    on(name: string, callback: () => void) {
      this.handlers.set(name, callback);
    }

    attachMedia = vi.fn();

    loadSource = vi.fn();

    destroy = vi.fn();
  },
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

const instances = (Hls as unknown as { instances: TestHls[] }).instances;
beforeEach(() => {
  instances.length = 0;
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

function setup(automaticQuality: boolean) {
  const display = makeVideoElementDisplayInterface();
  display.processVideoElement(document.createElement("video"));
  display.load({
    source: { type: "hls", url: "/jellyfin/stream.m3u8" },
    automaticQuality,
    preferredQuality: "1080",
    autoplay: false,
    startAt: 120,
  });
  return { display, hls: instances[0] };
}

describe("HLS quality integration", () => {
  it("seeds dimensionless adaptive streams without disabling bandwidth adaptation", () => {
    const { display, hls } = setup(true);
    hls.levels = [{ bitrate: 1_000_000 }, { bitrate: 4_000_000 }];
    hls.handlers.get(Hls.Events.MANIFEST_LOADED)?.();
    expect(hls.startLevel).toBe(1);
    expect(hls.currentLevel).toBe(-1);
    expect(hls.loadLevel).toBe(-1);
    display.destroy();
  });

  it("selects a concrete manual fallback and reports its actual resolution", () => {
    const { display, hls } = setup(false);
    const changed = vi.fn();
    display.on("changedquality", changed);
    hls.levels = [{ width: 1280, height: 534 }];
    hls.handlers.get(Hls.Events.MANIFEST_LOADED)?.();
    expect(hls.currentLevel).toBe(0);
    expect(hls.loadLevel).toBe(0);
    hls.handlers.get(Hls.Events.LEVEL_SWITCHED)?.();
    expect(changed).toHaveBeenLastCalledWith("720");
    display.destroy();
  });
});
