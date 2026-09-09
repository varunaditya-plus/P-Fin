export interface SpeechChunk {
  text: string;
  timestamp: [number | null, number | null];
}
export interface AlignmentCue {
  start: number;
  end: number;
  text: string;
}
export interface Alignment {
  offset: number;
  confidence: number;
  matches: number;
}
const words = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

/** Require multiple distinct dialogue matches and a consistent offset before applying it. */
export function alignSpeech(
  chunks: SpeechChunk[],
  cues: AlignmentCue[],
  startTime: number,
): Alignment | null {
  const used = new Set<number>();
  const matches: { offset: number; score: number }[] = [];
  for (const chunk of chunks) {
    if (chunk.timestamp[0] === null || chunk.timestamp[1] === null) continue;
    const tokens = words(chunk.text);
    if (tokens.length < 3) continue;
    const midpoint = startTime + (chunk.timestamp[0] + chunk.timestamp[1]) / 2;
    let best: { index: number; offset: number; score: number } | undefined;
    cues.forEach((cue, index) => {
      if (used.has(index)) return;
      const offset = midpoint - (cue.start + cue.end) / 2000;
      if (Math.abs(offset) > 45) return;
      const other = words(cue.text);
      if (other.length < 3) return;
      const common = new Set(tokens.filter((word) => other.includes(word)))
        .size;
      const score = (2 * common) / (new Set(tokens).size + new Set(other).size);
      if (score >= 0.65 && (!best || score > best.score))
        best = { index, offset, score };
    });
    if (best) {
      used.add(best.index);
      matches.push(best);
    }
  }
  if (matches.length < 3) return null;
  const ordered = matches.map((match) => match.offset).sort((a, b) => a - b);
  const median = ordered[Math.floor(ordered.length / 2)];
  const cluster = matches.filter(
    (match) => Math.abs(match.offset - median) <= 0.8,
  );
  const confidence =
    (cluster.length / matches.length) *
    (cluster.reduce((sum, match) => sum + match.score, 0) / cluster.length);
  if (cluster.length < 3 || confidence < 0.75) return null;
  return {
    offset:
      Math.round(
        (cluster.reduce((sum, match) => sum + match.offset, 0) /
          cluster.length) *
          100,
      ) / 100,
    confidence,
    matches: cluster.length,
  };
}

export function hasSpeechActivity(pcm: Float32Array, sampleRate: number) {
  const window = Math.max(1, Math.round(sampleRate * 0.05));
  let active = 0;
  let total = 0;
  for (let start = 0; start < pcm.length; start += window) {
    let sum = 0;
    const end = Math.min(pcm.length, start + window);
    for (let index = start; index < end; index += 1) sum += pcm[index] ** 2;
    if (Math.sqrt(sum / Math.max(1, end - start)) > 0.006) active += 1;
    total += 1;
  }
  return active >= 40 && active < total * 0.98;
}
