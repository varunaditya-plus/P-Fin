// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { mediaSourceLabel } from "./mediaSourceLabel";

describe("Jellyfin version labels", () => {
  it("preserves edition names and describes cropped 4K, HDR, codec, container and size", () => {
    expect(
      mediaSourceLabel({
        Id: "v1",
        Name: "Director's cut (B&W)",
        Container: "mkv",
        Size: 12 * 1024 ** 3,
        MediaStreams: [
          {
            Index: 0,
            Type: "Video",
            Width: 3840,
            Height: 1600,
            Codec: "hevc",
            VideoRangeType: "DOVIWithHDR10",
          },
        ],
      }),
    ).toBe(
      "Director's cut (B&W) · 4K · HEVC · Dolby Vision + HDR10 · MKV · 12.0 GB",
    );
  });
  it("does not invent unavailable file information", () => {
    expect(mediaSourceLabel({ Id: "v2" })).toBe("Original");
  });
});
