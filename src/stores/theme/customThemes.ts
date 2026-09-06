import {
  primaryOptions,
  secondaryOptions,
  tertiaryOptions,
} from "@themes/custom";

export const MAX_CUSTOM_THEMES = 30;
export const paletteOptions = {
  primary: primaryOptions,
  secondary: secondaryOptions,
  tertiary: tertiaryOptions,
};
export type PalettePart = keyof typeof paletteOptions;
export interface ThemePalette {
  primary: string;
  secondary: string;
  tertiary: string;
  primaryHex?: string;
  secondaryHex?: string;
  tertiaryHex?: string;
}
export interface SavedCustomTheme extends ThemePalette {
  id: string;
  name: string;
}
export interface ThemeSettings {
  theme: string | null;
  customTheme: ThemePalette;
  savedCustomThemes: SavedCustomTheme[];
  hiddenDefaultThemes: string[];
}
export const defaultPalette: ThemePalette = {
  primary: "classic",
  secondary: "classic",
  tertiary: "classic",
};
export const defaultThemeSettings: ThemeSettings = {
  theme: null,
  customTheme: defaultPalette,
  savedCustomThemes: [],
  hiddenDefaultThemes: [],
};
export const builtinThemeIds = primaryOptions.map((option) => option.id);
export function validHex(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}
export function validatePalette(value: unknown): ThemePalette {
  if (!value || typeof value !== "object")
    throw new Error("Choose a theme palette.");
  const input = value as Record<string, unknown>;
  const result = { ...defaultPalette };
  for (const part of Object.keys(paletteOptions) as PalettePart[]) {
    if (!paletteOptions[part].some((option) => option.id === input[part]))
      throw new Error(`Choose a valid ${part} palette.`);
    result[part] = input[part] as string;
    const key = `${part}Hex` as const;
    if (input[key] !== undefined && input[key] !== "") {
      if (!validHex(input[key]))
        throw new Error(
          "Colours must use six-digit hexadecimal values, such as #8b5cf6.",
        );
      result[key] = input[key].toLowerCase();
    }
  }
  return result;
}
export function validateCustomTheme(value: unknown): SavedCustomTheme {
  const input = value as Partial<SavedCustomTheme> | null;
  if (
    !input ||
    typeof input.id !== "string" ||
    !/^custom-[a-z0-9-]{1,70}$/.test(input.id)
  )
    throw new Error("Invalid custom theme identifier.");
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 60
  )
    throw new Error("Give the theme a name between 1 and 60 characters.");
  return { id: input.id, name: input.name.trim(), ...validatePalette(input) };
}
export function validateThemeSettings(value: unknown): ThemeSettings {
  if (!value || typeof value !== "object")
    throw new Error("Invalid theme settings.");
  const input = value as ThemeSettings;
  const saved = input.savedCustomThemes ?? [];
  if (!Array.isArray(saved) || saved.length > MAX_CUSTOM_THEMES)
    throw new Error(`You can save up to ${MAX_CUSTOM_THEMES} custom themes.`);
  const savedCustomThemes = saved.map(validateCustomTheme);
  if (
    new Set(savedCustomThemes.map((theme) => theme.id)).size !==
    savedCustomThemes.length
  )
    throw new Error("Custom theme identifiers must be unique.");
  const hidden = input.hiddenDefaultThemes ?? [];
  if (
    !Array.isArray(hidden) ||
    hidden.some((id) => !builtinThemeIds.includes(id))
  )
    throw new Error("Invalid hidden theme selection.");
  const hiddenDefaultThemes = [...new Set(hidden)];
  const visible = builtinThemeIds.filter((id) => !hidden.includes(id));
  if (!visible.length && !saved.length)
    hiddenDefaultThemes.splice(hiddenDefaultThemes.indexOf("default"), 1);
  const chosen = input.theme ?? "default";
  const theme =
    chosen === "custom" ||
    savedCustomThemes.some((entry) => entry.id === chosen) ||
    (builtinThemeIds.includes(chosen) && !hiddenDefaultThemes.includes(chosen))
      ? chosen
      : (visible[0] ?? savedCustomThemes[0]?.id ?? "default");
  return {
    theme,
    customTheme: validatePalette(input.customTheme ?? defaultPalette),
    savedCustomThemes,
    hiddenDefaultThemes,
  };
}
function rgbHsl(value: string) {
  const [red, green, blue] = value
    .split(" ")
    .map((channel) => Number(channel) / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  if (delta) {
    if (max === red)
      hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
    else if (max === green) hue = ((blue - red) / delta + 2) / 6;
    else hue = ((red - green) / delta + 4) / 6;
  }
  return {
    hue,
    saturation: delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0,
    lightness,
  };
}

/** Shift hue while retaining the preset's contrast hierarchy, including white/black text. */
function recolourTone(value: string, anchor: string, target: string) {
  const original = rgbHsl(value);
  if (original.lightness === 0 || original.lightness === 1) return value;
  const base = rgbHsl(anchor);
  const colour = rgbHsl(target);
  const delta = original.lightness - base.lightness;
  const lightness =
    delta >= 0
      ? colour.lightness +
        ((1 - colour.lightness) * delta) / Math.max(0.001, 1 - base.lightness)
      : colour.lightness +
        (colour.lightness * delta) / Math.max(0.001, base.lightness);
  const saturation = Math.max(
    0,
    Math.min(1, colour.saturation + original.saturation - base.saturation),
  );
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number) => {
    const k = (offset + colour.hue * 12) % 12;
    return Math.round(
      255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
    );
  };
  return `${channel(0)} ${channel(8)} ${channel(4)}`;
}

export function themeVariables(palette: ThemePalette): Record<string, string> {
  const checked = validatePalette(palette);
  const result: Record<string, string> = {};
  for (const part of Object.keys(paletteOptions) as PalettePart[]) {
    const colors = paletteOptions[part].find(
      (option) => option.id === checked[part],
    )!.colors;
    const hex = checked[`${part}Hex`];
    const rgb = hex
      ? [1, 3, 5]
          .map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
          .join(" ")
      : undefined;
    const anchor = {
      primary: "--colors-buttons-purple",
      secondary: "--colors-type-text",
      tertiary: "--colors-background-main",
    }[part];
    for (const [key, value] of Object.entries(colors)) {
      result[key] = rgb
        ? key === anchor
          ? rgb
          : recolourTone(value, colors[anchor], rgb)
        : value;
    }
  }
  result["--colors-themePreview-primary"] = result["--colors-buttons-purple"];
  result["--colors-themePreview-secondary"] = result["--colors-type-text"];
  result["--colors-themePreview-ghost"] = result["--colors-type-text"];
  return result;
}
