import {
  SourceQuality,
  getPreferredQuality,
} from "@/stores/player/utils/qualities";

interface Rendition {
  width?: number;
  height?: number;
  bitrate?: number;
}

const exactHeights: Record<number, SourceQuality> = {
  360: "360",
  480: "480",
  720: "720",
  1080: "1080",
  2160: "4k",
};
const widthThresholds: [number, SourceQuality][] = [
  [3200, "4k"],
  [1600, "1080"],
  [1000, "720"],
  [600, "480"],
  [0, "360"],
];
const heightThresholds: [number, SourceQuality][] = [
  [1800, "4k"],
  [800, "1080"],
  [600, "720"],
  [420, "480"],
  [0, "360"],
];

function validDimension(value?: number): number {
  return value && Number.isFinite(value) && value > 0 ? value : 0;
}

export function hlsLevelToQuality(level?: Rendition): SourceQuality | null {
  if (!level) return null;
  const width = validDimension(level.width);
  const height = validDimension(level.height);
  if (height && exactHeights[height]) return exactHeights[height];
  // Cropped films retain their source width even when their height is unusual.
  if (width) return widthThresholds.find(([minimum]) => width >= minimum)![1];
  if (height)
    return heightThresholds.find(([minimum]) => height >= minimum)![1];
  return "unknown";
}

export function hlsLevelsToQualities(levels: Rendition[]): SourceQuality[] {
  return [...new Set(levels.map((level) => hlsLevelToQuality(level)!))];
}

export function highestHlsLevel(levels: Rendition[]): number {
  const ranked = levels.map((level, index) => ({
    index,
    pixels: validDimension(level.width) * validDimension(level.height),
    height: validDimension(level.height),
    width: validDimension(level.width),
    bitrate: validDimension(level.bitrate),
  }));
  ranked.sort(
    (a, b) =>
      b.pixels - a.pixels ||
      b.height - a.height ||
      b.width - a.width ||
      b.bitrate - a.bitrate,
  );
  return ranked[0]?.index ?? -1;
}

export function manualHlsLevel(
  levels: Rendition[],
  preferredQuality: SourceQuality | null,
  currentLevel: number,
): number {
  if (
    (!preferredQuality || preferredQuality === "unknown") &&
    levels[currentLevel]
  ) {
    return currentLevel;
  }
  const availableQuality = getPreferredQuality(hlsLevelsToQualities(levels), {
    lastChosenQuality: preferredQuality,
    automaticQuality: false,
  });
  const matches = levels
    .map((level, index) => ({ level, index }))
    .filter(({ level }) => hlsLevelToQuality(level) === availableQuality);
  const bestMatch = highestHlsLevel(matches.map(({ level }) => level));
  return matches[bestMatch]?.index ?? highestHlsLevel(levels);
}
