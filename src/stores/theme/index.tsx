import { ReactNode, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  MAX_CUSTOM_THEMES,
  SavedCustomTheme,
  ThemePalette,
  ThemeSettings,
  defaultThemeSettings,
  themeVariables,
  validateCustomTheme,
  validatePalette,
  validateThemeSettings,
} from "./customThemes";

export type { SavedCustomTheme, ThemePalette } from "./customThemes";
export interface ThemeStore extends ThemeSettings {
  setTheme(value: string | null): void;
  setCustomTheme(value: ThemePalette): void;
  saveCustomTheme(value: SavedCustomTheme): void;
  deleteCustomTheme(id: string): void;
  hideDefaultTheme(id: string): void;
  resetThemes(): void;
}
const date = new Date();
const initialTheme =
  date.getMonth() === 3 && date.getDate() === 20
    ? "green"
    : date.getMonth() === 9 && date.getDate() === 31
      ? "autumn"
      : null;
export const useThemeStore = create(
  persist<ThemeStore>(
    (set) => ({
      ...defaultThemeSettings,
      theme: initialTheme,
      setTheme: (theme) =>
        set((state) => validateThemeSettings({ ...state, theme })),
      setCustomTheme: (customTheme) =>
        set({ customTheme: validatePalette(customTheme) }),
      saveCustomTheme: (value) =>
        set((state) => {
          const theme = validateCustomTheme(value);
          const existing = state.savedCustomThemes.some(
            (entry) => entry.id === theme.id,
          );
          if (!existing && state.savedCustomThemes.length >= MAX_CUSTOM_THEMES)
            throw new Error(
              `You can save up to ${MAX_CUSTOM_THEMES} custom themes.`,
            );
          return {
            savedCustomThemes: existing
              ? state.savedCustomThemes.map((entry) =>
                  entry.id === theme.id ? theme : entry,
                )
              : [...state.savedCustomThemes, theme],
          };
        }),
      deleteCustomTheme: (id) =>
        set((state) =>
          validateThemeSettings({
            ...state,
            savedCustomThemes: state.savedCustomThemes.filter(
              (entry) => entry.id !== id,
            ),
          }),
        ),
      hideDefaultTheme: (id) =>
        set((state) =>
          validateThemeSettings({
            ...state,
            hiddenDefaultThemes: [...state.hiddenDefaultThemes, id],
          }),
        ),
      resetThemes: () => set(defaultThemeSettings),
    }),
    {
      name: "__MW::theme",
      merge: (persisted, current) => {
        try {
          return { ...current, ...validateThemeSettings(persisted) };
        } catch {
          return current;
        }
      },
    },
  ),
);

export const usePreviewThemeStore = create<{
  previewTheme: string | null;
  previewPalette: ThemePalette | null;
  setPreviewTheme(value: string | null): void;
  setPreviewPalette(value: ThemePalette | null): void;
}>((set) => ({
  previewTheme: null,
  previewPalette: null,
  setPreviewTheme: (previewTheme) =>
    set({ previewTheme, previewPalette: null }),
  setPreviewPalette: (previewPalette) =>
    set({ previewPalette, previewTheme: previewPalette ? "custom" : null }),
}));

export function ThemeProvider({
  children,
  applyGlobal,
}: {
  children?: ReactNode;
  applyGlobal?: boolean;
}) {
  const preview = usePreviewThemeStore((state) => state.previewTheme);
  const previewPalette = usePreviewThemeStore((state) => state.previewPalette);
  const settings = useThemeStore();
  const selected = preview ?? settings.theme ?? "default";
  const custom = settings.savedCustomThemes.find(
    (theme) => theme.id === selected,
  );
  const palette =
    previewPalette ??
    custom ??
    (selected === "custom" ? settings.customTheme : undefined);
  const selector = palette ? "theme-custom" : `theme-${selected}`;
  const signature = JSON.stringify([selected, palette]);
  const previous = useRef(signature);
  const [transitioning, setTransitioning] = useState(false);
  useEffect(() => {
    if (!applyGlobal || previous.current === signature) return;
    previous.current = signature;
    setTransitioning(true);
    const timeout = setTimeout(() => setTransitioning(false), 240);
    return () => clearTimeout(timeout);
  }, [applyGlobal, signature]);
  const css = palette
    ? `.theme-custom { ${Object.entries(themeVariables(palette))
        .map(([key, value]) => `${key}: ${value};`)
        .join(" ")} }`
    : "";
  const changing =
    applyGlobal && (transitioning || previous.current !== signature);
  const className = `${selector}${changing ? " movie-fin-theme-transition" : ""}`;
  return (
    <div className={className}>
      <Helmet>
        <style>{`${css}
        @media (prefers-reduced-motion: no-preference) {
          .movie-fin-theme-transition, .movie-fin-theme-transition :where(button, a, section, [data-theme-surface]) {
            transition-property: background-color, color, border-color;
            transition-duration: 220ms;
          }
        }`}</style>
      </Helmet>
      {applyGlobal ? (
        <Helmet>
          <body className={className} />
        </Helmet>
      ) : null}
      {children}
    </div>
  );
}
