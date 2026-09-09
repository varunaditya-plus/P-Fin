// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { SpeechChunk, alignSpeech, hasSpeechActivity } from "./alignment";

const lines = [
  "Please open the window",
  "Someone left their umbrella",
  "Tomorrow we will return",
];
const cues = lines.map((text, index) => ({
  text,
  start: (index * 4 + 10) * 1000,
  end: (index * 4 + 12) * 1000,
}));
const chunks: SpeechChunk[] = lines.map((text, index) => ({
  text,
  timestamp: [index * 4 + 2, index * 4 + 4],
}));
describe("local subtitle alignment", () => {
  it("requires distinct confident matches and estimates the signed offset", () => {
    expect(alignSpeech(chunks, cues, 10)).toMatchObject({
      offset: 2,
      matches: 3,
      confidence: 1,
    });
    expect(alignSpeech(chunks.slice(0, 2), cues, 10)).toBeNull();
    expect(
      alignSpeech(
        chunks.map((c) => ({ ...c, text: "Irrelevant spoken words" })),
        cues,
        10,
      ),
    ).toBeNull();
    expect(alignSpeech(chunks, cues, 100)).toBeNull();
  });
  it("rejects inconsistent timing and repeated matches", () => {
    expect(alignSpeech([chunks[0], chunks[0], chunks[0]], cues, 10)).toBeNull();
    expect(
      alignSpeech(
        [chunks[0], chunks[1], { ...chunks[2], timestamp: [20, 22] }],
        cues,
        10,
      ),
    ).toBeNull();
  });
  it("gates silence and continuous noise before loading the speech model", () => {
    expect(hasSpeechActivity(new Float32Array(10000), 1000)).toBe(false);
    expect(hasSpeechActivity(new Float32Array(10000).fill(0.05), 1000)).toBe(
      false,
    );
    const sample = new Float32Array(10000);
    sample.fill(0.05, 1000, 4000);
    expect(hasSpeechActivity(sample, 1000)).toBe(true);
  });
});
