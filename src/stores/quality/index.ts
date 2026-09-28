import merge from "lodash.merge";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { SourceQuality } from "@/stores/player/utils/qualities";

export interface QualityStore {
  quality: {
    lastChosenQuality: SourceQuality | null;
    automaticQuality: boolean;
  };
}

export const useQualityStore = create(
  persist<QualityStore>(
    () => ({
      quality: {
        automaticQuality: true,
        lastChosenQuality: null,
      },
    }),
    {
      name: "__MW::quality",
      merge: (persisted, current) => merge({}, current, persisted),
    },
  ),
);
