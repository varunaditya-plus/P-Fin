// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import {
  highestHlsLevel,
  hlsLevelToQuality,
  hlsLevelsToQualities,
  manualHlsLevel,
} from "./hlsQuality";

describe("HLS rendition quality", () => {
  it("recognises cropped films by width without changing standard height labels", () => {
    expect(hlsLevelToQuality({ width: 3840, height: 1600 })).toBe("4k");
    expect(hlsLevelToQuality({ width: 1920, height: 800 })).toBe("1080");
    expect(hlsLevelToQuality({ width: 1280, height: 534 })).toBe("720");
    expect(hlsLevelToQuality({ width: 960, height: 720 })).toBe("720");
    expect(hlsLevelToQuality({ height: 2160 })).toBe("4k");
  });

  it("reports unknown dimensions once and chooses a real fallback by bitrate", () => {
    const levels = [
      { bitrate: 1_000_000 },
      { bitrate: 4_000_000 },
      { bitrate: 2_000_000 },
    ];
    expect(hlsLevelsToQualities(levels)).toEqual(["unknown"]);
    expect(highestHlsLevel(levels)).toBe(1);
    expect(manualHlsLevel(levels, "1080", -1)).toBe(1);
    expect(hlsLevelToQuality({ width: NaN, height: -1 })).toBe("unknown");
    expect(hlsLevelToQuality()).toBeNull();
    expect(manualHlsLevel([], "1080", -1)).toBe(-1);
  });

  it("keeps the actual rendition when adaptive selection ends without a new preference", () => {
    const levels = [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ];
    expect(manualHlsLevel(levels, null, 0)).toBe(0);
    expect(manualHlsLevel(levels, "unknown", 1)).toBe(1);
    expect(manualHlsLevel(levels, "1080", 0)).toBe(1);
  });

  it("deduplicates labels and chooses the best matching rendition before falling back", () => {
    const levels = [
      { width: 1280, height: 720, bitrate: 1_000_000 },
      { width: 1920, height: 1080, bitrate: 4_000_000 },
      { width: 1920, height: 1080, bitrate: 6_000_000 },
    ];
    expect(hlsLevelsToQualities(levels)).toEqual(["720", "1080"]);
    expect(manualHlsLevel(levels, "1080", -1)).toBe(2);
    expect(manualHlsLevel(levels, "4k", -1)).toBe(2);
    expect(manualHlsLevel(levels, "480", -1)).toBe(0);
  });
});
