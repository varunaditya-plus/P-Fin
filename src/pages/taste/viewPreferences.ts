import { create } from "zustand";

import { registerAppPreferenceSection } from "@/stores/appPreferences/registry";

const defaults = {
  library: false,
  seerr: false,
  type: "movie" as "movie" | "tv",
};
export const useTasteView = create<typeof defaults>(() => ({ ...defaults }));
registerAppPreferenceSection("recommendationView", {
  label: "Recommendation views",
  defaults,
  getSnapshot: useTasteView.getState,
  apply: (value) => useTasteView.setState(value),
  subscribe: useTasteView.subscribe,
  validate: (value) => {
    const input = value as Partial<typeof defaults> | null;
    return {
      library: input?.library === true,
      seerr: input?.seerr === true,
      type: input?.type === "tv" ? ("tv" as const) : ("movie" as const),
    };
  },
});
