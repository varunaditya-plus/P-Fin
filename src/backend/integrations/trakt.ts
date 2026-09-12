import { matchesSettingsSession } from "@/backend/jellyfin/appSettings";
import { jellyfinRequest } from "@/backend/jellyfin/client";
import { normalizeServerUrl } from "@/backend/jellyfin/servers";
import { JellyfinSession } from "@/stores/jellyfin";

export const TRAKT_PLUGIN_ID = "4fe3201e-d6ae-4f2e-8917-e12bda571281";

interface PluginInfo {
  Id?: string;
  Version?: string;
  Status?: string;
}

export interface TraktServerStatus {
  administrator: boolean;
  plugin: "unavailable" | "missing" | "active" | "inactive";
  version?: string;
  pluginState?: string;
  authorization: "linked" | "unlinked" | "unknown";
}

function assertSession(session: JellyfinSession, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!matchesSettingsSession(session))
    throw new Error("The Jellyfin account changed. Check Trakt again.");
}

/** Only reads the installed plugin and this user's boolean authorization status.
 * The plugin's global configuration contains other users' tokens; never fetch it.
 */
export async function getTraktServerStatus(
  session: JellyfinSession,
  signal?: AbortSignal,
): Promise<TraktServerStatus> {
  assertSession(session, signal);
  const user = await jellyfinRequest<{
    Policy?: { IsAdministrator?: boolean };
  }>(`Users/${encodeURIComponent(session.userId)}`, { signal });
  assertSession(session, signal);
  const result: TraktServerStatus = {
    administrator: Boolean(user.Policy?.IsAdministrator),
    plugin: "unavailable",
    authorization: "unknown",
  };
  // Jellyfin's Plugins API and the plugin's status endpoint require elevation.
  if (!result.administrator) return result;
  const plugins = await jellyfinRequest<PluginInfo[]>("Plugins", { signal });
  assertSession(session, signal);
  if (!Array.isArray(plugins))
    throw new Error("Jellyfin returned an unreadable plugin list. Try again.");
  const candidates = plugins.filter(
    (plugin) =>
      plugin.Id?.replaceAll("-", "").toLowerCase() ===
        TRAKT_PLUGIN_ID.replaceAll("-", "") &&
      !["Superseded", "Superceded", "Deleted"].includes(plugin.Status ?? ""),
  );
  candidates.sort((a, b) =>
    (b.Version ?? "").localeCompare(a.Version ?? "", undefined, {
      numeric: true,
    }),
  );
  const plugin =
    candidates.find((item) => item.Status === "Active") ?? candidates[0];
  if (!plugin) return { ...result, plugin: "missing" };
  result.plugin = plugin.Status === "Active" ? "active" : "inactive";
  result.pluginState = plugin.Status;
  result.version = plugin.Version;
  if (result.plugin !== "active") return result;

  try {
    // This endpoint returns no credentials. Older plugin versions can fail for a
    // user with no configuration, so failure means unknown, never unlinked.
    const authorization = await jellyfinRequest<{ isAuthorized?: boolean }>(
      `Trakt/Users/${encodeURIComponent(session.userId)}/PollAuthorizationStatus`,
      { signal },
    );
    assertSession(session, signal);
    if (typeof authorization?.isAuthorized === "boolean")
      result.authorization = authorization.isAuthorized ? "linked" : "unlinked";
  } catch {
    assertSession(session, signal);
  }
  return result;
}

/** Opens Jellyfin's own client without carrying this client's access token. */
export function traktJellyfinSettingsUrl(
  session: JellyfinSession,
  installed = true,
): string | null {
  const address = session.serverAddress ?? session.serverUrl;
  if (!/^https?:\/\//i.test(address)) return null;
  try {
    const base = normalizeServerUrl(address);
    const url = new URL(`${base}/web/index.html`);
    url.hash = installed
      ? "!/configurationpage?name=trakt"
      : "!/dashboard/plugins";
    return url.toString();
  } catch {
    return null;
  }
}
