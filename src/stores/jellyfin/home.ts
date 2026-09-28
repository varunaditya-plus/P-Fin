import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { JellyfinSession } from "@/stores/jellyfin";

export interface HomeSectionPreferences {
  rows?: number;
  density?: "comfortable" | "compact";
  editing?: boolean;
}

export interface HomePreferences {
  order: string[];
  hidden: string[];
  density: "comfortable" | "compact";
  layout: "carousel" | "grid";
  rows: number;
  sections?: Record<string, HomeSectionPreferences>;
}

export const defaultHomePreferences: HomePreferences = {
  order: [],
  hidden: [],
  density: "comfortable",
  layout: "carousel",
  rows: 2,
  sections: {},
};

export function homePreferenceScope(session: JellyfinSession | null) {
  return session
    ? JSON.stringify([
        session.serverId || session.serverAddress || session.serverUrl,
        session.userId,
      ])
    : "";
}

export const useHomePreferences = create(
  persist<{
    profiles: Record<string, HomePreferences>;
    update: (scope: string, changes: Partial<HomePreferences>) => void;
    reset: (scope: string) => void;
  }>(
    (set) => ({
      profiles: {},
      update: (scope, changes) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [scope]: {
              ...(state.profiles[scope] ?? defaultHomePreferences),
              ...changes,
              ...(changes.rows !== undefined
                ? { rows: Math.min(10, Math.max(1, Math.round(changes.rows))) }
                : {}),
            },
          },
        })),
      reset: (scope) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [scope]: { ...defaultHomePreferences },
          },
        })),
    }),
    {
      name: "jellyfin-home-layout",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
