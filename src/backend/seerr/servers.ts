import { JellyfinSession } from "@/stores/jellyfin";
import { SeerrConnection } from "@/stores/seerr";

export function normalizeSeerrUrl(address: string) {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Enter your Seerr server address.");
  let url: URL;
  try {
    url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`,
    );
  } catch {
    throw new Error(
      "Enter a valid Seerr address, such as http://your-server:5055.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an HTTP or HTTPS Seerr address without credentials, a query or a fragment.",
    );
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  return url.toString().replace(/\/+$/, "");
}

export async function getConfiguredSeerrServer(): Promise<string | null> {
  try {
    const response = await fetch("/server-config.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const config = (await response.json()) as { seerrUrl?: string };
    return config.seerrUrl ? normalizeSeerrUrl(config.seerrUrl) : null;
  } catch {
    return null;
  }
}

export function createSeerrConnection(
  address: string,
  _configuredAddress: string | null,
  authMethod: SeerrConnection["authMethod"],
  session: JellyfinSession,
): SeerrConnection {
  const url = normalizeSeerrUrl(address);
  // Seerr does not allow credentialed cross-origin API calls. The app proxy
  // forwards this address from the X-Seerr-Upstream header.
  return {
    url,
    apiUrl: "/seerr/api/v1",
    authMethod,
    jellyfinServerUrl: session.serverUrl,
    jellyfinUserId: session.userId,
    jellyfinAccessToken: session.accessToken,
  };
}
