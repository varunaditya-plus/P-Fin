import { useJellyfinAuth, useJellyfinServers } from "@/stores/jellyfin";

/** The client identity stays fixed; the interface uses the connected server. */
export const APP_NAME = "P-Fin";

export function getInterfaceName() {
  const { session } = useJellyfinAuth.getState();
  const { selectedServer } = useJellyfinServers.getState();
  if (session?.serverName?.trim()) return session.serverName.trim();
  if (
    selectedServer &&
    (!session ||
      (session.serverId
        ? selectedServer.id === session.serverId
        : selectedServer.apiUrl === session.serverUrl))
  )
    return selectedServer.name.trim() || APP_NAME;
  return APP_NAME;
}
