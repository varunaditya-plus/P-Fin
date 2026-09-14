import { create } from "zustand";

import { registerAppPreferenceSection } from "@/stores/appPreferences/registry";

const defaults = {
  library: null as boolean | null,
  seerr: null as boolean | null,
  type: "movie" as "movie" | "tv",
};
export function resolveTasteView(choice: boolean | null, hasSignals: boolean) {
  return choice ?? hasSignals;
}
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
      library: typeof input?.library === "boolean" ? input.library : null,
      seerr: typeof input?.seerr === "boolean" ? input.seerr : null,
      type: input?.type === "tv" ? ("tv" as const) : ("movie" as const),
    };
  },
});
