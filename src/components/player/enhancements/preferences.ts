import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_VIDEO_APPEARANCE,
  VideoAppearance,
  normalizeVideoAppearance,
} from "@/components/player/display/videoAppearance";

interface PlaybackEnhancementPreferences {
  picture: VideoAppearance;
  setPicture: (field: keyof VideoAppearance, value: number) => void;
  resetPicture: (field?: keyof VideoAppearance) => void;
}

export const usePlaybackEnhancements = create(
  persist<PlaybackEnhancementPreferences>(
    (set) => ({
      picture: { ...DEFAULT_VIDEO_APPEARANCE },
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
    }),
    {
      name: "movie-fin-playback-enhancements",
      merge: (persisted, current) => ({
        ...current,
        picture: normalizeVideoAppearance(
          (persisted as Partial<PlaybackEnhancementPreferences> | undefined)
            ?.picture ?? {},
        ),
      }),
    },
  ),
);
