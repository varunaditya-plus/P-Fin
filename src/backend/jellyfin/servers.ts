import { JellyfinServer } from "@/stores/jellyfin";

export interface JellyfinPublicUser {
  Id: string;
  Name: string;
  HasPassword?: boolean;
  PrimaryImageTag?: string;
}

export interface JellyfinServerLogin {
  users: JellyfinPublicUser[];
  disclaimer?: string;
}

export function normalizeServerUrl(address: string) {
  const trimmed = address.trim();
  if (!trimmed) throw new Error("Enter your Jellyfin server address.");
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(
      "Enter a valid server address, such as http://192.168.1.10:8096.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error(
      "Use an HTTP or HTTPS server address without a username or password.",
    );
  const pastedWebClient = /\/web(?:\/index\.html)?\/?$/.test(url.pathname);
  if ((url.search || url.hash) && !pastedWebClient)
    throw new Error("Enter the server address without a query or fragment.");
  url.search = "";
  url.hash = "";
  // Accept the address copied from Jellyfin's web client, including a base path.
  url.pathname = url.pathname
    .replace(/\/web(?:\/index\.html)?\/?$/, "")
    .replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

export function serverEndpoint(
  server: Pick<JellyfinServer, "apiUrl">,
  path: string,
) {
  return new URL(
    `${server.apiUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
    window.location.origin,
  ).toString();
}

function connectionError(error: unknown) {
  if (
    error instanceof DOMException &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return new Error(
      "The server took too long to respond. Check its address and your network connection.",
    );
  return new Error(
    "Could not connect to this Jellyfin server. Check the address and that the server is reachable. For a direct connection, the server must allow this site's origin.",
  );
}

async function publicRequest<T>(apiUrl: string, path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(serverEndpoint({ apiUrl }, path), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      credentials: "omit",
    });
  } catch (error) {
    throw connectionError(error);
  }
  if (!response.ok)
    throw new Error(
      `The Jellyfin server could not complete the connection (${response.status}).`,
    );
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      "This address did not return a Jellyfin response. Check the server address and port.",
    );
  }
}

export async function getConfiguredJellyfinServer(): Promise<string | null> {
  try {
    const response = await fetch("/server-config.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const config = (await response.json()) as { jellyfinUrl?: string };
    return config.jellyfinUrl ? normalizeServerUrl(config.jellyfinUrl) : null;
  } catch {
    return null;
  }
}

export async function connectJellyfinServer(
  address: string,
  configuredAddress?: string | null,
): Promise<JellyfinServer> {
  const url = normalizeServerUrl(address);
  const useProxy = Boolean(
    configuredAddress && url === normalizeServerUrl(configuredAddress),
  );
  const apiUrl = useProxy ? "/jellyfin" : url;
  if (
    !useProxy &&
    window.location.protocol === "https:" &&
    new URL(url).protocol === "http:"
  )
    throw new Error(
      "This page uses HTTPS and cannot connect directly to an HTTP server. Use the configured server connection below, open this client over HTTP on your trusted network, or enable HTTPS on Jellyfin.",
    );
  const info = await publicRequest<{
    Id?: string;
    ServerName?: string;
    Version?: string;
  }>(apiUrl, "System/Info/Public");
  if (!info.Id || !info.ServerName)
    throw new Error("No Jellyfin server was found at this address.");
  return {
    id: info.Id,
    name: info.ServerName,
    version: info.Version,
    url,
    apiUrl,
  };
}

export async function getServerLogin(
  server: JellyfinServer,
): Promise<JellyfinServerLogin> {
  const [users, branding] = await Promise.all([
    publicRequest<JellyfinPublicUser[]>(server.apiUrl, "Users/Public"),
    publicRequest<{ LoginDisclaimer?: string }>(
      server.apiUrl,
      "Branding/Configuration",
    ).catch(() => ({}) as { LoginDisclaimer?: string }),
  ]);
  return { users, disclaimer: branding.LoginDisclaimer };
}
