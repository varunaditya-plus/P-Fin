// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { trickplayFrame } from "./trickplay";

const tiles = {
  version: {
    320: {
      Width: 320,
      Height: 180,
      TileWidth: 10,
      TileHeight: 10,
      ThumbnailCount: 203,
      Interval: 10000,
    },
  },
};
describe("Jellyfin seek previews", () => {
  it("selects the correct sheet and tile for the selected version", () => {
    expect(trickplayFrame(tiles, "version", 1010)).toMatchObject({
      sheet: 1,
      x: 320,
      y: 0,
    });
    expect(trickplayFrame(tiles, "missing", 10)).toBeNull();
  });
  it("clamps endpoints and ignores invalid metadata", () => {
    expect(trickplayFrame(tiles, "version", -5)).toMatchObject({
      sheet: 0,
      x: 0,
      y: 0,
    });
    expect(trickplayFrame(tiles, "version", 99999)).toMatchObject({
      sheet: 2,
      x: 640,
      y: 0,
    });
    expect(trickplayFrame(tiles, "version", NaN)).toBeNull();
    expect(trickplayFrame(undefined, "version", 10)).toBeNull();
  });
});
