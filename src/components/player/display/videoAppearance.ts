export interface VideoAppearance {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

export const DEFAULT_VIDEO_APPEARANCE: VideoAppearance = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
};
export const VIDEO_APPEARANCE_LIMITS: Record<
  keyof VideoAppearance,
  [number, number]
> = {
  brightness: [10, 200],
  contrast: [0, 200],
  saturation: [0, 200],
  hue: [-180, 180],
};

export function normalizeVideoAppearance(
  value: Partial<VideoAppearance>,
): VideoAppearance {
  return Object.fromEntries(
    Object.entries(DEFAULT_VIDEO_APPEARANCE).map(([key, fallback]) => {
      const field = key as keyof VideoAppearance;
      const [minimum, maximum] = VIDEO_APPEARANCE_LIMITS[field];
      const number = value[field];
      return [
        field,
        typeof number === "number" && Number.isFinite(number)
          ? Math.min(maximum, Math.max(minimum, number))
          : fallback,
      ];
    }),
  ) as unknown as VideoAppearance;
}

export function videoAppearanceFilter(value: Partial<VideoAppearance>): string {
  const appearance = normalizeVideoAppearance(value);
  if (
    Object.entries(DEFAULT_VIDEO_APPEARANCE).every(
      ([key, fallback]) =>
        appearance[key as keyof VideoAppearance] === fallback,
    )
  )
    return "none";
  return `brightness(${appearance.brightness}%) contrast(${appearance.contrast}%) saturate(${appearance.saturation}%) hue-rotate(${appearance.hue}deg)`;
}
