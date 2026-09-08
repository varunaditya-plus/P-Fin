import { create } from "zustand";

import { registerAppPreferenceSection } from "@/stores/appPreferences/registry";

interface SubtitleToolsPreferences {
  autoSync: boolean;
  translationEndpoint: string;
  targetLanguage: string;
}
const defaults: SubtitleToolsPreferences = {
  autoSync: false,
  translationEndpoint: "",
  targetLanguage: "en",
};
export function validateSubtitleTools(
  value: unknown,
): SubtitleToolsPreferences {
  const input = value as Partial<SubtitleToolsPreferences> | null;
  const endpoint =
    typeof input?.translationEndpoint === "string"
      ? input.translationEndpoint.trim()
      : "";
  if (endpoint) {
    const url = new URL(endpoint);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid translation endpoint.");
  }
  return {
    autoSync: input?.autoSync === true,
    translationEndpoint: endpoint,
    targetLanguage:
      typeof input?.targetLanguage === "string" &&
      /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(input.targetLanguage)
        ? input.targetLanguage
        : "en",
  };
}
export const useSubtitleTools = create<SubtitleToolsPreferences>(() => ({
  ...defaults,
}));
registerAppPreferenceSection("subtitleTools", {
  label: "Subtitle tools",
  defaults,
  getSnapshot: useSubtitleTools.getState,
  apply: (value) => useSubtitleTools.setState(value),
  subscribe: useSubtitleTools.subscribe,
  validate: validateSubtitleTools,
});
