// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadCaption } from "./subs";

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
    expect(fetchMock).toHaveBeenCalledWith(url);
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
