// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getJellyfinSession } from "./client";
import { ContentItem, ContentSource, ContentStream } from "./content";
import {
  downloadFileName,
  downloadSize,
  downloadStreamUrl,
  downloadSubtitleFile,
  downloadableSubtitle,
  originalDownloadUrl,
  selectedDownloadSource,
  subtitleDownloadName,
} from "./downloads";

vi.mock("./client", () => ({
  getJellyfinSession: vi.fn(),
  jellyfinUrl: (path: string, query: Record<string, string>) =>
    `http://localhost/jellyfin/${path}?${new URLSearchParams(query)}`,
}));
const first = "11111111111111111111111111111111";
const second = "22222222222222222222222222222222";
const subtitle: ContentStream = {
  Index: 3,
  Type: "Subtitle",
  Codec: "subrip",
  Language: "spa",
  IsForced: true,
};
const source: ContentSource = {
  Id: second,
  Name: "Director's cut",
  Path: "/media/Film/Director.mkv",
  Container: "mkv",
  Size: 2147483648,
  MediaStreams: [subtitle],
};
const item: ContentItem = {
  Id: first,
  Name: "Film",
  Type: "Movie",
  MediaSources: [{ Id: first }, source],
};
const owner = {
  serverUrl: "/jellyfin",
  userId: "user",
  userName: "User",
  deviceId: "browser",
  accessToken: "test-token",
};
beforeEach(() => {
  vi.mocked(getJellyfinSession).mockReturnValue(owner);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Jellyfin downloads", () => {
  it("downloads the selected original item while stream URLs select its media source", () => {
    expect(selectedDownloadSource(item, second)).toBe(source);
    expect(new URL(originalDownloadUrl(item, source)!).pathname).toBe(
      `/jellyfin/Items/${second}/Download`,
    );
    const stream = new URL(downloadStreamUrl(item, source));
    expect(stream.pathname).toBe(`/jellyfin/Videos/${first}/stream`);
    expect(stream.searchParams.get("MediaSourceId")).toBe(second);
    expect(stream.searchParams.get("token")).toBe("test-token");
    expect(
      originalDownloadUrl(item, { Id: "remote-source", Protocol: "Http" }),
    ).toBeUndefined();
    expect(downloadFileName(item, source)).toBe("Director.mkv");
    expect(downloadSize(source.Size)).toBe("2.0 GiB");
  });
  it("uses episode/language/track identity in safe subtitle filenames", () => {
    expect(
      subtitleDownloadName(
        {
          ...item,
          Type: "Episode",
          SeriesName: "Show:Name",
          ParentIndexNumber: 2,
          IndexNumber: 3,
        },
        subtitle,
        "srt",
      ),
    ).toBe("Show_Name.S02E03.spa.3.forced.srt");
    expect(downloadableSubtitle({ ...subtitle, Codec: "pgssub" })).toBe(false);
  });
  it("exports the selected subtitle and decodes the server encoding without corrupting accents", async () => {
    const utf16 = new Uint8Array([255, 254, 72, 0, 233, 0]);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/plain;charset=utf-16le" }),
      arrayBuffer: async () => utf16.buffer,
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await downloadSubtitleFile(item, source, subtitle, "srt");
    expect(result.text).toBe("Hé");
    expect(result.filename).toBe("Film.spa.3.forced.srt");
    expect(result.contentType).toContain("charset=utf-8");
    expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe(
      `/jellyfin/Videos/${first}/${second}/Subtitles/3/Stream.srt`,
    );
  });
  it("rejects image subtitles and empty exports rather than downloading broken files", async () => {
    await expect(
      downloadSubtitleFile(
        item,
        source,
        { ...subtitle, Codec: "pgssub" },
        "srt",
      ),
    ).rejects.toThrow("text subtitle");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    );
    await expect(
      downloadSubtitleFile(item, source, subtitle, "vtt"),
    ).rejects.toThrow("empty");
  });
});
