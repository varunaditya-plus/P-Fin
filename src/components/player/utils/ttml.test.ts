// @vitest-environment jsdom
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "vitest";

import { convertSubtitlesToVtt, parseSubtitles } from "./captions";
import { parseTTML, timedTextTime } from "./ttml";

const documentText = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:frameRate="25"><head><styling><style xml:id="bold" tts:fontWeight="bold" tts:color="#fff"/></styling><layout><region xml:id="top" tts:origin="10% 5%" tts:extent="80% 20%" tts:displayAlign="before"/></layout></head><body begin="1s"><div><p begin="1s" dur="2s" region="top" style="bold">Hello <span tts:fontStyle="italic">world</span><br/>Again &amp; again</p><p begin="2s" end="4s">Overlap</p></div></body></tt>`;
describe("TTML captions", () => {
  it("preserves inherited timing, overlap, region and validated span styling", () => {
    const cues = parseTTML(documentText);
    expect(cues[0]).toMatchObject({
      start: 2000,
      end: 4000,
      region: { x: 10, y: 5, width: 80, height: 20, align: "start" },
      style: { fontWeight: "bold" },
    });
    expect(cues[0].content).toContain("font-style:italic");
    expect(cues[1]).toMatchObject({ start: 3000, end: 5000 });
    expect(cues[0].text).toContain("Again & again");
    expect(parseSubtitles(documentText)).toBe(parseSubtitles(documentText));
  });
  it("produces a readable native fallback and supports frame/tick times", () => {
    expect(convertSubtitlesToVtt(documentText)).toContain(
      "00:00:02.000 --> 00:00:04.000",
    );
    expect(timedTextTime("00:00:01:12", 24)).toBe(1500);
    expect(timedTextTime("25f", 25)).toBe(1000);
    expect(timedTextTime("10t", 30, 10)).toBe(1000);
  });
  it("rejects malformed documents and strips executable markup and unsafe colour values", () => {
    expect(() => parseTTML("<tt>broken")).toThrow("malformed");
    expect(() => parseTTML("<!DOCTYPE tt><tt/>")).toThrow("declarations");
    const cues = parseTTML(
      '<tt xmlns:tts="http://www.w3.org/ns/ttml#styling"><body><p begin="0s" end="1s"><span tts:color="red;position:fixed">Safe</span><img src="bad" onerror="alert(1)"/></p></body></tt>',
    );
    expect(cues[0].content).toBe("Safe");
  });
});
