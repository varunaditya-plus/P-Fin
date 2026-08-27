// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";

import {
  authenticatedStreamUrl,
  getPlayback,
  getTranscodingUrl,
  reportPlayback,
} from "./playback";

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({
    accessToken: "current-test-token",
    userId: "user",
    deviceId: "device",
    serverUrl: "/jellyfin",
  }),
  jellyfinRequest: vi.fn(),
  jellyfinUrl: (path: string, query: Record<string, unknown> = {}) => {
    const url = new URL(
      `/jellyfin/${path.replace(/^\//, "")}`,
      window.location.origin,
    );
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
    return url.toString();
  },
}));

beforeEach(() => {
  vi.mocked(jellyfinRequest).mockReset();
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Jellyfin playback", () => {
  it("keeps media requests on the configured server and uses Jellyfin 12's ApiKey query parameter", () => {
    const url = new URL(
      authenticatedStreamUrl(
        "https://other.example/videos/item/master.m3u8?api_key=old&token=old&ApiKey=old&MediaSourceId=source",
      ),
    );
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe("/jellyfin/videos/item/master.m3u8");
    expect(url.searchParams.get("ApiKey")).toBe("current-test-token");
    expect(url.searchParams.has("api_key")).toBe(false);
    expect(url.searchParams.has("token")).toBe(false);
    expect(url.searchParams.get("MediaSourceId")).toBe("source");
  });

  it("includes the media source when selecting audio/subtitles so Jellyfin honours the selection", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      PlaySessionId: "session",
      MediaSources: [
        {
          Id: "source",
          TranscodingUrl: "/videos/item/master.m3u8?ApiKey=old",
          MediaStreams: [],
        },
      ],
    });
    const result = await getPlayback("item", {
      mediaSourceId: "source",
      audioIndex: 2,
      subtitleIndex: -1,
      forceTranscode: true,
    });
    const [, init] = vi.mocked(jellyfinRequest).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toMatchObject({
      MediaSourceId: "source",
      AudioStreamIndex: 2,
      SubtitleStreamIndex: -1,
      EnableDirectPlay: false,
      EnableDirectStream: false,
    });
    expect(result.source.type).toBe("hls");
    expect(result.playMethod).toBe("Transcode");
    expect(result.audioIndex).toBe(2);
  });

  it("uses a direct Jellyfin file only when the server says it is supported", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      PlaySessionId: "session",
      MediaSources: [
        {
          Id: "source",
          Container: "mp4",
          SupportsDirectPlay: true,
          MediaStreams: [],
        },
      ],
    });
    const result = await getPlayback("item", { mediaSourceId: "source" });
    expect(result.playMethod).toBe("DirectPlay");
    expect(result.source.type).toBe("file");
    if (result.source.type !== "file")
      throw new Error("Expected a file source");
    const url = new URL(result.source.qualities.unknown!.url);
    expect(url.pathname).toBe("/jellyfin/Videos/item/stream.mp4");
    expect(url.searchParams.get("Static")).toBe("true");
    expect(url.searchParams.get("ApiKey")).toBe("current-test-token");
  });

  it("extracts text subtitles locally and leaves image subtitles for burn-in", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      PlaySessionId: "session",
      MediaSources: [
        {
          Id: "source",
          Container: "mp4",
          SupportsDirectPlay: true,
          MediaStreams: [
            {
              Index: 4,
              Type: "Subtitle",
              IsTextSubtitleStream: true,
              Language: "eng",
              DisplayTitle: "English",
            },
            {
              Index: 5,
              Type: "Subtitle",
              IsTextSubtitleStream: false,
              Codec: "pgssub",
              Language: "eng",
            },
          ],
        },
      ],
    });
    const result = await getPlayback("item", { mediaSourceId: "source" });
    expect(result.captions).toHaveLength(1);
    expect(result.captions[0]).toMatchObject({
      id: "jellyfin-4",
      language: "en",
      needsProxy: false,
    });
    expect(new URL(result.captions[0].url).pathname).toBe(
      "/jellyfin/Videos/item/source/Subtitles/4/0/Stream.vtt",
    );
  });

  it("does not fall back to providers when Jellyfin refuses playback", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({ ErrorCode: "NotAllowed" });
    await expect(getPlayback("item")).rejects.toThrow("NotAllowed");
  });

  it("caps incompatible software transcodes but preserves compatible remux resolution", () => {
    const incompatible = {
      Id: "source",
      MediaStreams: [{ Type: "Video", Index: 0, Codec: "hevc" }],
      TranscodingUrl:
        "/videos/item/master.m3u8?VideoCodec=h264&VideoBitrate=120000000",
    };
    const fallback = new URL(getTranscodingUrl(incompatible, {}));
    expect(fallback.searchParams.get("MaxWidth")).toBe("1920");
    expect(fallback.searchParams.get("MaxHeight")).toBe("1080");
    expect(fallback.searchParams.get("VideoBitrate")).toBe("20000000");
    const low = new URL(
      getTranscodingUrl(incompatible, {
        forceTranscode: true,
        maxBitrate: 2_000_000,
      }),
    );
    expect(low.searchParams.get("MaxHeight")).toBe("720");
    const compatible = new URL(
      getTranscodingUrl(
        {
          ...incompatible,
          TranscodingUrl:
            "/videos/item/master.m3u8?VideoCodec=hevc,h264&VideoBitrate=120000000",
        },
        {},
      ),
    );
    expect(compatible.searchParams.has("MaxWidth")).toBe(false);
    expect(compatible.searchParams.get("VideoBitrate")).toBe("120000000");
  });

  it("reports server resume positions in ticks with the active media session and tracks", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue(undefined);
    await reportPlayback(
      "Stopped",
      {
        itemId: "item",
        playSessionId: "session",
        mediaSource: { Id: "source" },
        source: { type: "hls", url: "https://example.test/video" },
        captions: [],
        audioIndex: 2,
        subtitleIndex: -1,
        playMethod: "Transcode",
      },
      {
        time: 123.5,
        paused: true,
        muted: false,
        volume: 0.7,
        subtitleIndex: 4,
      },
    );
    const [path, init] = vi.mocked(jellyfinRequest).mock.calls[0];
    expect(path).toBe("/Sessions/Playing/Stopped");
    expect(init?.keepalive).toBe(true);
    expect(JSON.parse(init!.body as string)).toMatchObject({
      PositionTicks: 1235000000,
      PlaySessionId: "session",
      ItemId: "item",
      AudioStreamIndex: 2,
      SubtitleStreamIndex: 4,
      VolumeLevel: 70,
    });
  });
});
