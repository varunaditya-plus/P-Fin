// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, vi } from "vitest";

import { decodeSubtitle, downloadCaption } from "./subs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Jellyfin subtitle downloads", () => {
  it("loads and caches Jellyfin WebVTT directly without an external proxy", async () => {
    const url = "/jellyfin/Videos/title/source/Subtitles/1/0/Stream.vtt";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello\n", {
        headers: { "Content-Type": "text/vtt; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const caption = { id: "jellyfin-1", language: "en", url };
    const content = await downloadCaption(caption);
    expect(content).toContain("00:00:01,000 --> 00:00:03,000");
    expect(content).toContain("Hello");
    expect(await downloadCaption(caption)).toBe(content);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, {
      signal: expect.any(AbortSignal),
    });
  });

  it("reports Jellyfin subtitle failures instead of falling back to external services", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      downloadCaption({
        id: "denied",
        language: "en",
        url: "/jellyfin/subtitle-denied",
      }),
    ).rejects.toThrow("Could not load subtitle (403).");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("subtitle request ownership", () => {
  it("shares in-flight work while allowing an obsolete track to cancel independently", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn(
      (_url: string, _options: RequestInit) =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const caption = { id: "shared", language: "und", url: "/shared-track.vtt" };
    const controller = new AbortController();
    const first = downloadCaption(caption, controller.signal);
    const rejected = expect(first).rejects.toMatchObject({
      name: "AbortError",
    });
    const second = downloadCaption(caption);
    controller.abort();
    finish(new Response("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nShared\n"));
    await rejected;
    expect(await second).toContain("Shared");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false);
  });
  it("falls back from an invalid charset and decodes a UTF-16 byte order mark", () => {
    expect(
      decodeSubtitle(
        new TextEncoder().encode("Hello").buffer,
        'text/plain; charset="invented"',
      ),
    ).toBe("Hello");
    expect(
      decodeSubtitle(new Uint8Array([255, 254, 72, 0, 105, 0]).buffer, ""),
    ).toBe("Hi");
  });
});
