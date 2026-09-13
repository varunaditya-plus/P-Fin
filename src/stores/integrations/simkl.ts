import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { registerAppPreferenceSection } from "@/stores/appPreferences/registry";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { homePreferenceScope } from "@/stores/jellyfin/home";

export interface SimklConnection {
  clientId: string;
  accessToken: string;
  expiresAt: number;
  scopes: string;
  profile: { id: number; name: string };
  jellyfinScope: string;
  jellyfinToken: string;
}

// Browser-only integration: never persist OAuth tokens or include them in settings exports.
export const useSimklConnection = create<{
  connection: SimklConnection | null;
  setConnection(connection: SimklConnection | null): void;
}>((set) => ({
  connection: null,
  setConnection: (connection) => set({ connection }),
}));

export const useSimklPreferences = create(
  persist<{
    profiles: Record<string, string>;
    setClientId(scope: string, clientId: string): void;
  }>(
    (set) => ({
      profiles: {},
      setClientId: (scope, clientId) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [scope]: clientId.trim().slice(0, 500),
          },
        })),
    }),
    {
      name: "simkl-public-applications",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
const currentScope = () =>
  homePreferenceScope(useJellyfinAuth.getState().session);
registerAppPreferenceSection<string>("simklApplication", {
  label: "Simkl public application",
  defaults: "",
  validate: (value) =>
    typeof value === "string" ? value.trim().slice(0, 500) : "",
  getSnapshot: () =>
    useSimklPreferences.getState().profiles[currentScope()] ?? "",
  localFallback: () =>
    useSimklPreferences.getState().profiles[currentScope()] ?? "",
  apply: (value) => {
    const scope = currentScope();
    if (scope) useSimklPreferences.getState().setClientId(scope, value);
  },
  subscribe: (listener) => useSimklPreferences.subscribe(listener),
});
