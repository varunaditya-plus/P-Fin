// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  transcriptCues,
  transcriptMatches,
  translateTranscript,
} from "./transcript";

afterEach(() => {
  vi.unstubAllGlobals();
});
const cues = transcriptCues(
  "1\n00:00:02,000 --> 00:00:04,000\n<b>Héllo</b> world\n",
);
describe("subtitle transcript tools", () => {
  it("searches readable text across accents and words without rendering markup", () => {
    expect(cues[0].text).toBe("Héllo world");
    expect(transcriptMatches(cues[0].text, "hello world")).toBe(true);
    expect(transcriptMatches(cues[0].text, "absent")).toBe(false);
  });
  it("translates through an explicitly configured endpoint and preserves timing", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ translatedText: ["Hola mundo"] })),
      );
    vi.stubGlobal("fetch", request);
    const progress = vi.fn();
    const translated = await translateTranscript(
      cues,
      "https://example.test/translate",
      "es",
      "",
      new AbortController().signal,
      progress,
    );
    expect(translated[0]).toMatchObject({
      text: "Hola mundo",
      start: 2000,
      end: 4000,
    });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
      q: ["Héllo world"],
      source: "auto",
      target: "es",
      format: "text",
    });
    expect(progress).toHaveBeenCalledWith(100);
  });
  it("rejects unsafe endpoints and incomplete translations instead of applying a partial track", async () => {
    const signal = new AbortController().signal;
    await expect(
      translateTranscript(
        cues,
        "ftp://example.test/translate",
        "es",
        "",
        signal,
        () => {},
      ),
    ).rejects.toThrow("HTTP");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ translatedText: [] })),
        ),
    );
    await expect(
      translateTranscript(
        cues,
        "https://example.test/translate",
        "es",
        "",
        signal,
        () => {},
      ),
    ).rejects.toThrow("invalid response");
  });
});
