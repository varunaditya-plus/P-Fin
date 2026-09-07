import merge from "lodash.merge";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { isFirefox } from "@/utils/detectFeatures";

export interface SubtitleStyling {
  /**
   * Text color of subtitles, hex string
   */
  color: string;

  /**
   * size percentage, ranges between 0.01 and 2
   */
  size: number;

  /**
   * background opacity, ranges between 0 and 1
   */
  backgroundOpacity: number;

  /**
   * background blur, ranges between 0 and 1
   */
  backgroundBlur: number;

  /**
   * whether background blur is enabled (disabled by default on Firefox due to flickering issues)
   */
  backgroundBlurEnabled: boolean;

  /**
   * bold, boolean
   */
  bold: boolean;

  /**
   * vertical position percentage, ranges between 1 and 3 (rem)
   */
  verticalPosition: number;

  /**
   * font style for text rendering
   * "default" | "raised" | "depressed" | "Border" | "dropShadow"
   */
  fontStyle: string;

  /**
   * border thickness for Border font style, ranges between 0 and 10
   */
  borderThickness: number;

  /** Multiplier applied to each subtitle line. */
  lineHeight: number;
}

export interface SubtitleStore {
  enabled: boolean;
  lastSelectedLanguage: string | null;
  lastSelectedSubtitleId: string | null;
  styling: SubtitleStyling;
  overrideCasing: boolean;
  delay: number;
  showDelayIndicator: boolean;
  updateStyling(newStyling: Partial<SubtitleStyling>): void;
  resetStyling(): void;
  setSubtitle(
    enabled: boolean,
    language?: string | null,
    subtitleId?: string | null,
  ): void;
  setOverrideCasing(enabled: boolean): void;
  setDelay(delay: number): void;
  setShowDelayIndicator: (show: boolean) => void;
}

export const useSubtitleStore = create(
  persist(
    immer<SubtitleStore>((set) => ({
      enabled: false,
      lastSelectedLanguage: null,
      lastSelectedSubtitleId: null,
      overrideCasing: false,
      delay: 0,
      styling: {
        color: "#ffffff",
        backgroundOpacity: 0.5,
        size: 1,
        backgroundBlur: 0.5,
        backgroundBlurEnabled: !isFirefox,
        bold: false,
        verticalPosition: 1,
        fontStyle: "default",
        borderThickness: 1,
        lineHeight: 1.5,
      },
      showDelayIndicator: false,

      updateStyling(newStyling) {
        set((s) => {
          if (newStyling.backgroundOpacity !== undefined)
            s.styling.backgroundOpacity = Math.min(
              1,
              Math.max(0, newStyling.backgroundOpacity),
            );
          if (newStyling.backgroundBlur !== undefined)
            s.styling.backgroundBlur = Math.min(
              1,
              Math.max(0, newStyling.backgroundBlur),
            );
          if (newStyling.backgroundBlurEnabled !== undefined)
            s.styling.backgroundBlurEnabled = newStyling.backgroundBlurEnabled;
          if (newStyling.color !== undefined)
            s.styling.color = newStyling.color.toLowerCase();
          if (newStyling.size !== undefined)
            s.styling.size = Math.min(10, Math.max(0.01, newStyling.size));
          if (newStyling.bold !== undefined) s.styling.bold = newStyling.bold;
          if (
            newStyling.lineHeight !== undefined &&
            Number.isFinite(newStyling.lineHeight)
          )
            s.styling.lineHeight = Math.min(
              3,
              Math.max(0.8, newStyling.lineHeight),
            );
          if (
            newStyling.verticalPosition !== undefined &&
            Number.isFinite(newStyling.verticalPosition)
          )
            s.styling.verticalPosition = Math.min(
              20,
              Math.max(0, newStyling.verticalPosition),
            );
          if (newStyling.fontStyle !== undefined)
            s.styling.fontStyle = newStyling.fontStyle;
          if (newStyling.borderThickness !== undefined)
            s.styling.borderThickness = Math.min(
              10,
              Math.max(0, newStyling.borderThickness),
            );
        });
      },
      resetStyling() {
        set((s) => {
          s.styling = {
            color: "#ffffff",
            backgroundOpacity: 0.5,
            size: 1,
            backgroundBlur: 0.5,
            backgroundBlurEnabled: !isFirefox,
            bold: false,
            verticalPosition: 1,
            fontStyle: "default",
            borderThickness: 1,
            lineHeight: 1.5,
          };
        });
      },
      setSubtitle(enabled, language, subtitleId) {
        set((s) => {
          s.enabled = enabled;
          if (enabled) {
            s.lastSelectedLanguage = language ?? null;
            s.lastSelectedSubtitleId = subtitleId ?? null;
          } else {
            s.lastSelectedLanguage = null;
            s.lastSelectedSubtitleId = null;
          }
        });
      },
      setOverrideCasing(enabled) {
        set((s) => {
          s.overrideCasing = enabled;
        });
      },
      setDelay(delay) {
        set((s) => {
          s.delay = Math.max(Math.min(500, delay), -500);
        });
      },

      setShowDelayIndicator(show: boolean) {
        set((s) => {
          s.showDelayIndicator = show;
        });
      },
    })),
    {
      name: "__MW::subtitles",
      version: 1,
      migrate: (persisted) => persisted as SubtitleStore,
      merge: (persisted, current) =>
        merge(
          {},
          current,
          Object.fromEntries(
            Object.entries((persisted ?? {}) as Partial<SubtitleStore>).filter(
              ([key]) =>
                key in current &&
                typeof current[key as keyof SubtitleStore] !== "function",
            ),
          ),
        ),
    },
  ),
);
