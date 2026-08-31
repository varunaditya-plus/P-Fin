// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { JellyfinItem } from "./client";
import { getInitialPlaybackSelection } from "./playbackSelection";

const item: JellyfinItem = {
  Id: "movie",
  Name: "Movie",
  Type: "Movie",
  RunTimeTicks: 60_000_000_000,
  UserData: { PlaybackPositionTicks: 2_000_000_000 },
  MediaSources: [
    { Id: "original" },
    { Id: "alternate", RunTimeTicks: 50_000_000_000 },
  ],
};

describe("Jellyfin version and chapter navigation", () => {
  it("resumes normally and honours a requested alternate version", () => {
    expect(
      getInitialPlaybackSelection(
        item,
        new URLSearchParams("mediaSourceId=alternate"),
      ),
    ).toMatchObject({ mediaSource: { Id: "alternate" }, startAt: 200 });
  });
  it("starts a chapter before the saved resume point and handles explicit restart", () => {
    expect(
      getInitialPlaybackSelection(
        item,
        new URLSearchParams("startTicks=100000000&restart=true"),
      ).startAt,
    ).toBe(10);
    expect(
      getInitialPlaybackSelection(item, new URLSearchParams("restart=true"))
        .startAt,
    ).toBe(0);
  });
  it("rejects unavailable versions and malformed chapter links", () => {
    expect(() =>
      getInitialPlaybackSelection(
        item,
        new URLSearchParams("mediaSourceId=deleted"),
      ),
    ).toThrow("no longer available");
    for (const value of ["-1", "NaN", "Infinity", "1.5", "9007199254740992"])
      expect(() =>
        getInitialPlaybackSelection(
          item,
          new URLSearchParams(`startTicks=${value}`),
        ),
      ).toThrow("invalid start time");
  });
  it("keeps start times within the selected version's duration", () => {
    expect(
      getInitialPlaybackSelection(
        item,
        new URLSearchParams("mediaSourceId=alternate&startTicks=60000000000"),
      ).startAt,
    ).toBe(4999.9);
  });
  it("validates explicit audio and subtitle tracks against the selected version", () => {
    const media = {
      ...item,
      MediaSources: [
        {
          Id: "original",
          MediaStreams: [
            { Index: 1, Type: "Audio" },
            { Index: 3, Type: "Subtitle" },
          ],
        },
      ],
    };
    expect(
      getInitialPlaybackSelection(
        media,
        new URLSearchParams("audioIndex=1&subtitleIndex=3"),
      ),
    ).toMatchObject({ audioIndex: 1, subtitleIndex: 3 });
    expect(
      getInitialPlaybackSelection(
        media,
        new URLSearchParams("subtitleIndex=-1"),
      ).subtitleIndex,
    ).toBe(-1);
    expect(() =>
      getInitialPlaybackSelection(media, new URLSearchParams("audioIndex=3")),
    ).toThrow("audio track is no longer available");
    expect(() =>
      getInitialPlaybackSelection(
        media,
        new URLSearchParams("subtitleIndex=99"),
      ),
    ).toThrow("subtitle track is no longer available");
  });
});
