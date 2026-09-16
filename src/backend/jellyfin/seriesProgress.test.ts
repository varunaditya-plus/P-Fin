// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { JellyfinItem } from "./client";
import { seriesProgress } from "./seriesProgress";

describe("whole-series watched progress", () => {
  it("counts every available season once and uses the server watched flag rather than a local percentage", () => {
    const episode = (
      Id: string,
      ParentIndexNumber: number,
      Played = false,
    ): JellyfinItem => ({
      Id,
      Type: "Episode",
      Name: Id,
      ParentIndexNumber,
      UserData: { Played },
    });
    const first = episode("first", 1, true);
    const progress = seriesProgress([
      first,
      first,
      episode("second", 2, true),
      {
        ...episode("progress", 3),
        UserData: { Played: false, PlayedPercentage: 99 },
      },
      { ...episode("missing", 3, true), IsMissing: true },
      { ...episode("virtual", 4, true), IsVirtualItem: true },
    ]);
    expect(progress).toMatchObject({ watched: 2, total: 3 });
    expect(progress.percentage).toBeCloseTo(200 / 3);
  });
  it("handles an empty series without NaN progress", () => {
    expect(seriesProgress([])).toEqual({ watched: 0, total: 0, percentage: 0 });
  });
});
