import {
  SimklConnection,
  useSimklConnection,
} from "@/stores/integrations/simkl";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { homePreferenceScope } from "@/stores/jellyfin/home";

import { integrationIdentity, requireIntegrationIdentity } from "./library";

export class SimklError extends Error {
  code: string;

  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "SimklError";
    this.code = code;
    this.status = status;
  }
}
export interface SimklDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

async function request<T>(
  clientId: string,
  path: string,
  options: RequestInit,
  token?: string,
): Promise<T> {
  const url = new URL(`https://api.simkl.com${path}`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("app-name", "movie-fin");
  url.searchParams.set("app-version", "1.0");
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body)
    headers.set(
      "Content-Type",
      options.body instanceof URLSearchParams
        ? "application/x-www-form-urlencoded"
        : "application/json",
    );
  const timeout = new AbortController();
  const abort = () => timeout.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    options.signal?.throwIfAborted();
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "omit",
      cache: "no-store",
      signal: timeout.signal,
    });
    const data = await response.text();
    const body = data ? JSON.parse(data) : undefined;
    if (!response.ok)
      throw new SimklError(
        response.status === 429
          ? "Simkl rate limit reached. Wait before trying again."
          : body?.error_description ||
            body?.message ||
            `Simkl request failed (${response.status}).`,
        body?.error || "request_failed",
        response.status,
      );
    return body as T;
  } catch (error) {
    options.signal?.throwIfAborted();
    if (error instanceof SimklError) throw error;
    throw new Error(
      timeout.signal.aborted
        ? "Simkl took too long to respond. Try again."
        : "Unable to reach Simkl. Check your connection and whether your browser blocks api.simkl.com.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export function startSimklConnection(clientId: string, signal?: AbortSignal) {
  if (!clientId.trim())
    throw new Error(
      "Enter the client ID of your public Simkl AUTH V2 application.",
    );
  return request<SimklDeviceCode>(clientId.trim(), "/oauth2/device", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId.trim(),
      scope: "media:read media:write",
    }),
    signal,
  });
}

export async function pollSimklConnection(
  clientId: string,
  code: string,
  identity: ReturnType<typeof integrationIdentity>,
  signal?: AbortSignal,
) {
  requireIntegrationIdentity(identity);
  const token = await request<{
    access_token: string;
    expires_in: number;
    scope: string;
  }>(clientId, "/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      device_code: code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
    signal,
  });
  requireIntegrationIdentity(identity);
  signal?.throwIfAborted();
  if (!token.access_token || !token.scope?.split(" ").includes("media:read"))
    throw new Error(
      "Simkl did not grant read access. Reconnect and approve the application.",
    );
  const profile = await request<{
    user: { name: string };
    account: { id: number };
  }>(clientId, "/users/settings", { signal }, token.access_token);
  requireIntegrationIdentity(identity);
  signal?.throwIfAborted();
  const connection: SimklConnection = {
    clientId,
    accessToken: token.access_token,
    scopes: token.scope,
    expiresAt: Date.now() + token.expires_in * 1000,
    profile: { id: profile.account.id, name: profile.user.name },
    jellyfinScope: identity.scope,
    jellyfinToken: identity.token,
  };
  useSimklConnection.getState().setConnection(connection);
  return connection;
}

export function requireSimklConnection() {
  const connection = useSimklConnection.getState().connection;
  if (!connection) throw new Error("Connect your Simkl account first.");
  requireIntegrationIdentity({
    scope: connection.jellyfinScope,
    token: connection.jellyfinToken,
  });
  if (connection.expiresAt <= Date.now())
    throw new Error(
      "Your Simkl connection expired. Disconnect and reconnect to continue.",
    );
  return connection;
}

export async function simklRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const connection = requireSimklConnection();
  if (
    options.method === "POST" &&
    !connection.scopes.split(" ").includes("media:write")
  )
    throw new Error(
      "This Simkl connection is read-only. Reconnect and grant write access to export.",
    );
  const result = await request<T>(
    connection.clientId,
    path,
    options,
    connection.accessToken,
  );
  if (useSimklConnection.getState().connection !== connection)
    throw new Error("Your Simkl connection changed. Preview again.");
  requireIntegrationIdentity({
    scope: connection.jellyfinScope,
    token: connection.jellyfinToken,
  });
  return result;
}

export async function disconnectSimkl() {
  const connection = useSimklConnection.getState().connection;
  useSimklConnection.getState().setConnection(null);
  if (connection)
    await request(connection.clientId, "/oauth2/revoke", {
      method: "POST",
      body: new URLSearchParams({
        client_id: connection.clientId,
        token: connection.accessToken,
      }),
    });
}

useJellyfinAuth.subscribe((state, previous) => {
  if (
    (state.session?.accessToken !== previous.session?.accessToken ||
      homePreferenceScope(state.session) !==
        homePreferenceScope(previous.session)) &&
    useSimklConnection.getState().connection
  )
    disconnectSimkl().catch(() => {});
});
