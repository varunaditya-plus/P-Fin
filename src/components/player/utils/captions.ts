import DOMPurify from "dompurify";
import { convert, detect, parse } from "subsrt-ts";

import { TimedTextCue, isTTML, parseTTML, timedTextToSrt } from "./ttml";

export type CaptionCueType = TimedTextCue;
export const sanitize = DOMPurify.sanitize;

export function captionIsVisible(
  start: number,
  end: number,
  delay: number,
  currentTime: number,
) {
  const delayedStart = start / 1000 + delay;
  const delayedEnd = end / 1000 + delay;
  return (
    Math.max(0, delayedStart) <= currentTime &&
    Math.max(0, delayedEnd) >= currentTime
  );
}

export function makeQueId(index: number, start: number, end: number): string {
  return `${index}-${start}-${end}`;
}

export function convertSubtitlesToVtt(text: string): string {
  if (isTTML(text)) return convert(timedTextToSrt(parseTTML(text)), "vtt");
  const textTrimmed = text.trim();
  if (textTrimmed === "") {
    throw new Error("Given text is empty");
  }
  const vtt = convert(textTrimmed, "vtt");
  if (detect(vtt) === "") {
    throw new Error("Invalid subtitle format");
  }
  return vtt;
}

export function convertSubtitlesToSrt(text: string): string {
  if (isTTML(text)) return timedTextToSrt(parseTTML(text));
  const textTrimmed = text.trim();
  if (textTrimmed === "") {
    throw new Error("Given text is empty");
  }
  const srt = convert(textTrimmed, "srt");
  if (detect(srt) === "") {
    throw new Error("Invalid subtitle format");
  }
  return srt;
}

export function parseVttSubtitles(vtt: string) {
  return parse(vtt).filter((cue) => cue.type === "caption") as CaptionCueType[];
}

const parsedCache = new Map<string, CaptionCueType[]>();
export function parseSubtitles(
  text: string,
  _language?: string,
): CaptionCueType[] {
  const cached = parsedCache.get(text);
  if (cached) return cached;
  const cues = isTTML(text)
    ? parseTTML(text)
    : parseVttSubtitles(convertSubtitlesToVtt(text));
  if (parsedCache.size >= 8)
    parsedCache.delete(parsedCache.keys().next().value!);
  parsedCache.set(text, cues);
  return cues;
}

export function convertSubtitlesToObjectUrl(text: string): string {
  return URL.createObjectURL(
    new Blob([convertSubtitlesToVtt(text)], {
      type: "text/vtt",
    }),
  );
}
