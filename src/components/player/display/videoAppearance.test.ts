// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIDEO_APPEARANCE,
  normalizeVideoAppearance,
  videoAppearanceFilter,
} from "./videoAppearance";

describe("video picture settings", () => {
  it("clamps persisted or incoming settings and replaces invalid numbers", () => {
    expect(
      normalizeVideoAppearance({
        brightness: -20,
        contrast: 500,
        saturation: NaN,
        hue: Infinity,
      }),
    ).toEqual({ brightness: 10, contrast: 200, saturation: 100, hue: 0 });
    expect(normalizeVideoAppearance({})).toEqual(DEFAULT_VIDEO_APPEARANCE);
  });
  it("removes the filter entirely at default values", () => {
    expect(videoAppearanceFilter(DEFAULT_VIDEO_APPEARANCE)).toBe("none");
  });
});
