import { create } from "zustand";
import { persist } from "zustand/middleware";

import { clampAudioBoost } from "@/components/player/display/audioBoost";
import {
  DEFAULT_VIDEO_APPEARANCE,
  VideoAppearance,
  normalizeVideoAppearance,
} from "@/components/player/display/videoAppearance";

interface PlaybackEnhancementPreferences {
  picture: VideoAppearance;
  boostByTitle: Record<string, number>;
  activeItem: string | null;
  activeTitle: string | null;
  boost: number;
  rememberBoost: boolean;
  appliedBoost: number;
  audioError: string;
  setPicture: (field: keyof VideoAppearance, value: number) => void;
  resetPicture: (field?: keyof VideoAppearance) => void;
  bindPlayback: (itemId: string | null, titleKey: string | null) => void;
  setBoost: (percent: number) => void;
  setRememberBoost: (remember: boolean) => void;
  reportBoost: (percent: number, error?: string) => void;
}
export function normalizeBoostByTitle(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      )
      .map(([key, percent]) => [key, clampAudioBoost(percent / 100) * 100]),
  );
}

export const usePlaybackEnhancements = create<PlaybackEnhancementPreferences>()(
  persist(
    (set) => ({
      picture: { ...DEFAULT_VIDEO_APPEARANCE },
      boostByTitle: {},
      activeItem: null,
      activeTitle: null,
      boost: 100,
      rememberBoost: false,
      appliedBoost: 100,
      audioError: "",
      setPicture: (field, value) =>
        set((state) => ({
          picture: normalizeVideoAppearance({
            ...state.picture,
            [field]: value,
          }),
        })),
      resetPicture: (field) =>
        set((state) => ({
          picture: field
            ? { ...state.picture, [field]: DEFAULT_VIDEO_APPEARANCE[field] }
            : { ...DEFAULT_VIDEO_APPEARANCE },
        })),
      bindPlayback: (itemId, titleKey) =>
        set((state) => {
          if (state.activeItem === itemId && state.activeTitle === titleKey)
            return state;
          const saved = titleKey ? state.boostByTitle[titleKey] : undefined;
          return {
            activeItem: itemId,
            activeTitle: titleKey,
            boost: saved ?? 100,
            rememberBoost: saved !== undefined,
            appliedBoost: 100,
            audioError: "",
          };
        }),
      setBoost: (percent) =>
        set((state) => {
          const boost = clampAudioBoost(percent / 100) * 100;
          return {
            boost,
            boostByTitle:
              state.rememberBoost && state.activeTitle
                ? { ...state.boostByTitle, [state.activeTitle]: boost }
                : state.boostByTitle,
          };
        }),
      setRememberBoost: (remember) =>
        set((state) => {
          const boostByTitle = { ...state.boostByTitle };
          if (state.activeTitle) {
            if (remember) boostByTitle[state.activeTitle] = state.boost;
            else delete boostByTitle[state.activeTitle];
          }
          return { rememberBoost: remember, boostByTitle };
        }),
      reportBoost: (percent, error = "") =>
        set({ appliedBoost: percent, audioError: error }),
    }),
    {
      name: "movie-fin-playback-enhancements",
      partialize: (state) => ({
        picture: state.picture,
        boostByTitle: state.boostByTitle,
      }),
      merge: (persisted, current) => {
        const saved = persisted as
          | Partial<PlaybackEnhancementPreferences>
          | undefined;
        return {
          ...current,
          picture: normalizeVideoAppearance(saved?.picture ?? {}),
          boostByTitle: normalizeBoostByTitle(saved?.boostByTitle),
        };
      },
    },
  ),
);
