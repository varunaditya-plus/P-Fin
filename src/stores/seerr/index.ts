import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { JellyfinSession } from "@/stores/jellyfin";

export interface SeerrConnection {
  url: string;
  apiUrl: string;
  authMethod: "jellyfin" | "local";
  jellyfinServerUrl: string;
  jellyfinUserId: string;
  jellyfinAccessToken: string;
  userId?: number;
}

export function matchesSeerrSession(
  connection: SeerrConnection | null | undefined,
  session: JellyfinSession | null | undefined,
) {
  return Boolean(
    connection &&
      session &&
      connection.jellyfinServerUrl === session.serverUrl &&
      connection.jellyfinUserId === session.userId &&
      connection.jellyfinAccessToken === session.accessToken,
  );
}

export const useSeerrConnection = create(
  persist<{
    connection: SeerrConnection | null;
    setConnection: (connection: SeerrConnection | null) => void;
  }>(
    (set) => ({
      connection: null,
      setConnection: (connection) => set({ connection }),
    }),
    {
      name: "seerr-connection",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
