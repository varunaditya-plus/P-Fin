import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface JellyfinSession {
  serverUrl: string;
  accessToken: string;
  userId: string;
  userName: string;
  deviceId: string;
}

export const useJellyfinAuth = create(
  persist<{
    session: JellyfinSession | null;
    setSession: (session: JellyfinSession | null) => void;
  }>((set) => ({ session: null, setSession: (session) => set({ session }) }), {
    name: "jellyfin-session",
    storage: createJSONStorage(() => sessionStorage),
  }),
);
