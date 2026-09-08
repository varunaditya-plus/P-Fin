import {
  CaptionCueType,
  parseSubtitles,
} from "@/components/player/utils/captions";

export function plainCueText(cue: CaptionCueType) {
  return (
    new DOMParser().parseFromString(
      cue.content.replace(/<br\s*\/?\s*>/gi, "\n"),
      "text/html",
    ).body.textContent ?? ""
  );
}
export function transcriptCues(text: string) {
  return parseSubtitles(text).map((cue) => ({
    ...cue,
    text: plainCueText(cue),
  }));
}
export function transcriptMatches(text: string, query: string) {
  const normalise = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const value = normalise(text);
  return normalise(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => value.includes(word));
}
export async function translateTranscript(
  cues: CaptionCueType[],
  endpoint: string,
  target: string,
  apiKey: string,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
) {
  const url = new URL(endpoint);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Enter the HTTP or HTTPS translate endpoint without credentials or query parameters.",
    );
  if (!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(target))
    throw new Error("Enter a target language code, for example es.");
  const output: CaptionCueType[] = [];
  for (let start = 0; start < cues.length; start += 20) {
    signal.throwIfAborted();
    const batch = cues.slice(start, start + 20);
    const response = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: batch.map(plainCueText),
        source: "auto",
        target,
        format: "text",
        ...(apiKey ? { api_key: apiKey } : {}),
      }),
    });
    if (!response.ok)
      throw new Error(
        `Translation failed (${response.status}). Check the endpoint, browser access and API key.`,
      );
    const result = (await response.json()) as { translatedText?: unknown };
    if (
      !Array.isArray(result.translatedText) ||
      result.translatedText.length !== batch.length ||
      result.translatedText.some((value) => typeof value !== "string")
    )
      throw new Error(
        "The translation service returned an invalid response. Use a LibreTranslate-compatible endpoint.",
      );
    output.push(
      ...batch.map((cue, index) => ({
        ...cue,
        content: (result.translatedText as string[])[index]
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;"),
        text: (result.translatedText as string[])[index],
        style: undefined,
        region: undefined,
      })),
    );
    onProgress(Math.round((output.length / cues.length) * 100));
  }
  return output;
}
