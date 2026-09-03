import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KeyboardShortcuts,
} from "@/utils/keyboardShortcuts";

export interface PreferencesStore {
  enableAutoplay: boolean;
  enableFeatured: boolean;
  enableImageLogos: boolean;
  enableMinimalCards: boolean;
  forceCompactEpisodeView: boolean;
  enableLowPerformanceMode: boolean;
  enableNativeSubtitles: boolean;
  enableHoldToBoost: boolean;
  enableDoubleClickToSeek: boolean;
  enableNumberKeySeeking: boolean;
  enablePauseOverlay: boolean;
  keyboardShortcuts: KeyboardShortcuts;

  setEnableAutoplay(v: boolean): void;
  setEnableFeatured(v: boolean): void;
  setEnableImageLogos(v: boolean): void;
  setEnableMinimalCards(v: boolean): void;
  setForceCompactEpisodeView(v: boolean): void;
  setEnableLowPerformanceMode(v: boolean): void;
  setEnableNativeSubtitles(v: boolean): void;
  setEnableHoldToBoost(v: boolean): void;
  setEnableDoubleClickToSeek(v: boolean): void;
  setEnableNumberKeySeeking(v: boolean): void;
  setEnablePauseOverlay(v: boolean): void;
  setKeyboardShortcuts(v: KeyboardShortcuts): void;
}

export const usePreferencesStore = create(
  persist(
    immer<PreferencesStore>((set) => ({
      enableAutoplay: true,
      enableFeatured: false,
      enableImageLogos: true,
      enableMinimalCards: false,
      forceCompactEpisodeView: false,
      enableLowPerformanceMode: false,
      enableNativeSubtitles: false,
      enableHoldToBoost: true,
      enableDoubleClickToSeek: false,
      enableNumberKeySeeking: true,
      enablePauseOverlay: false,
      keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,

      setEnableAutoplay(v) {
        set((s) => {
          s.enableAutoplay = v;
        });
      },

      setEnableFeatured(v) {
        set((s) => {
          s.enableFeatured = v;
        });
      },

      setEnableImageLogos(v) {
        set((s) => {
          s.enableImageLogos = v;
        });
      },

      setEnableMinimalCards(v) {
        set((s) => {
          s.enableMinimalCards = v;
        });
      },

      setForceCompactEpisodeView(v) {
        set((s) => {
          s.forceCompactEpisodeView = v;
        });
      },
      setEnableLowPerformanceMode(v) {
        set((s) => {
          s.enableLowPerformanceMode = v;
          // When enabling performance mode, disable bandwidth-heavy features
          if (v) {
            s.enableAutoplay = false;
          }
        });
      },
      setEnableNativeSubtitles(v) {
        set((s) => {
          s.enableNativeSubtitles = v;
        });
      },
      setEnableHoldToBoost(v) {
        set((s) => {
          s.enableHoldToBoost = v;
        });
      },

      setEnableDoubleClickToSeek(v) {
        set((s) => {
          s.enableDoubleClickToSeek = v;
        });
      },

      setEnableNumberKeySeeking(v) {
        set((s) => {
          s.enableNumberKeySeeking = v;
        });
      },
      setEnablePauseOverlay(v) {
        set((s) => {
          s.enablePauseOverlay = v;
        });
      },
      setKeyboardShortcuts(v) {
        set((s) => {
          s.keyboardShortcuts = v;
        });
      },
    })),
    {
      name: "__MW::preferences",
      version: 1,
      migrate: (persisted) => persisted as PreferencesStore,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PreferencesStore>;
        const preferences = Object.fromEntries(
          Object.entries(saved).filter(
            ([key]) =>
              key in current &&
              typeof current[key as keyof PreferencesStore] !== "function",
          ),
        );
        return { ...current, ...preferences };
      },
    },
  ),
);
