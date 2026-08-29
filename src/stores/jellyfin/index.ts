import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface JellyfinServer {
  id: string;
  name: string;
  /** The address shown to the user. */
  url: string;
  /** Configured servers use the same-origin proxy; other servers connect directly. */
  apiUrl: string;
  version?: string;
}

export interface JellyfinSession {
  serverUrl: string;
  serverId?: string;
  serverName?: string;
  serverAddress?: string;
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

export const useJellyfinServers = create(
  persist<{
    servers: JellyfinServer[];
    selectedServer: JellyfinServer | null;
    saveServer: (server: JellyfinServer) => void;
    selectServer: (server: JellyfinServer | null) => void;
    removeServer: (id: string) => void;
  }>(
    (set) => ({
      servers: [],
      selectedServer: null,
      saveServer: (server) =>
        set((state) => ({
          servers: [
            ...state.servers.filter((existing) => existing.id !== server.id),
            server,
          ],
          selectedServer: server,
        })),
      selectServer: (server) => set({ selectedServer: server }),
      removeServer: (id) =>
        set((state) => ({
          servers: state.servers.filter((server) => server.id !== id),
          selectedServer:
            state.selectedServer?.id === id ? null : state.selectedServer,
        })),
    }),
    {
      name: "jellyfin-servers",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
