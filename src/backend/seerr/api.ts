import { useJellyfinAuth, useJellyfinServers } from "@/stores/jellyfin";
import {
  SeerrConnection,
  matchesSeerrSession,
  useSeerrConnection,
} from "@/stores/seerr";
import { MediaItem } from "@/utils/mediaTypes";

import {
  SeerrDetails,
  SeerrMedia,
  SeerrMediaType,
  SeerrPage,
  SeerrQuota,
  SeerrRequest,
  SeerrSettings,
  SeerrUser,
} from "./types";

export class SeerrError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SeerrError";
    this.status = status;
  }
}

interface ConnectionContext {
  connection: SeerrConnection;
  explicit: boolean;
  hadSession: boolean;
  selectedServerId?: string;
  selectedServerUrl?: string;
}

function sameConnection(
  first: SeerrConnection | null,
  second: SeerrConnection,
) {
  return Boolean(
    first &&
      first.apiUrl === second.apiUrl &&
      first.url === second.url &&
      first.authMethod === second.authMethod &&
      first.userId === second.userId &&
      first.jellyfinServerUrl === second.jellyfinServerUrl &&
      first.jellyfinUserId === second.jellyfinUserId &&
      first.jellyfinAccessToken === second.jellyfinAccessToken,
  );
}

function assertConnection(context: ConnectionContext) {
  const session = useJellyfinAuth.getState().session;
  const selectedServer = useJellyfinServers.getState().selectedServer;
  const sameSession = matchesSeerrSession(context.connection, session);
  const pendingSession =
    context.explicit &&
    !context.hadSession &&
    !session &&
    context.selectedServerId === selectedServer?.id &&
    context.selectedServerUrl === selectedServer?.apiUrl;
  if (
    (!sameSession && !pendingSession) ||
    (!context.explicit &&
      !sameConnection(
        useSeerrConnection.getState().connection,
        context.connection,
      ))
  ) {
    throw new SeerrError(
      "Your Jellyfin or Seerr connection changed. Connect Seerr again for this account.",
      401,
    );
  }
}

function captureConnection(explicit?: SeerrConnection): ConnectionContext {
  const connection = explicit ?? useSeerrConnection.getState().connection;
  if (!connection)
    throw new SeerrError("Connect Seerr to discover and request content.", 403);
  const selectedServer = useJellyfinServers.getState().selectedServer;
  const context = {
    connection: { ...connection },
    explicit: Boolean(explicit),
    hadSession: Boolean(useJellyfinAuth.getState().session),
    selectedServerId: selectedServer?.id,
    selectedServerUrl: selectedServer?.apiUrl,
  };
  assertConnection(context);
  return context;
}

function seerrApiBase(connection: SeerrConnection) {
  let url: URL;
  try {
    url = new URL(connection.apiUrl, window.location.origin);
  } catch {
    throw new SeerrError("Enter a valid Seerr server address.", 400);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new SeerrError(
      "Use an HTTP or HTTPS Seerr address without credentials, a query, or a fragment.",
      400,
    );
  return connection.apiUrl.replace(/\/+$/, "");
}

async function fetchFromSeerr<T>(
  connection: SeerrConnection,
  path: string,
  options: RequestInit,
  context?: ConnectionContext,
): Promise<T> {
  const apiBase = seerrApiBase(connection);
  if (context) assertConnection(context);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (context) assertConnection(context);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new SeerrError(
        data?.message ||
          data?.error ||
          (response.status === 401
            ? "Sign in to Seerr again. If this is a custom server, its cookie and CORS settings must allow this app."
            : "Seerr could not complete this request. Please try again."),
        response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    const data = await response.json();
    if (context) assertConnection(context);
    return data as T;
  } catch (error) {
    if (timedOut)
      throw new SeerrError(
        "Seerr took too long to respond. Check its address and connection, then try again.",
        504,
      );
    if (error instanceof TypeError)
      throw new SeerrError(
        "Cannot reach Seerr. Check the server address. For a custom server, allow this app's origin in CORS with credentials and permit its session cookie, or use a same-origin reverse proxy. HTTPS apps require an HTTPS Seerr connection.",
        0,
      );
    if (error instanceof SyntaxError)
      throw new SeerrError(
        "This address did not return Seerr API data. Check the server address and its base path.",
        502,
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function seerrFetch<T>(
  path: string,
  options?: RequestInit,
  connection?: SeerrConnection,
): Promise<T> {
  const context = captureConnection(connection);
  return fetchFromSeerr<T>(context.connection, path, options ?? {}, context);
}

let sessionOperation: Promise<unknown> = Promise.resolve();

function changeSeerrSession<T>(operation: () => Promise<T>) {
  const result = sessionOperation.catch(() => undefined).then(operation);
  sessionOperation = result;
  return result;
}

// Serialize cookie mutations and capture targets before queuing any credentials.
// Passwords only exist for the duration of the authentication request.
export async function authenticateSeerr(
  username: string,
  password: string,
  connection?: SeerrConnection,
) {
  const context = captureConnection(connection);
  return changeSeerrSession(() =>
    fetchFromSeerr<SeerrUser>(
      context.connection,
      context.connection.authMethod === "local"
        ? "/auth/local"
        : "/auth/jellyfin",
      {
        method: "POST",
        body: JSON.stringify(
          context.connection.authMethod === "local"
            ? { email: username, password }
            : { username, password, email: username },
        ),
      },
      context,
    ),
  );
}

async function fetchSeerrUser(context: ConnectionContext) {
  const user = await fetchFromSeerr<SeerrUser>(
    context.connection,
    "/auth/me",
    {},
    context,
  );
  if (
    (context.connection.authMethod === "jellyfin" &&
      user.jellyfinUserId !== context.connection.jellyfinUserId) ||
    (context.connection.userId !== undefined &&
      user.id !== context.connection.userId)
  ) {
    throw new SeerrError(
      "The Seerr session belongs to a different account. Connect Seerr again for this account.",
      401,
    );
  }
  return user;
}

export async function getSeerrUser(connection?: SeerrConnection) {
  return fetchSeerrUser(captureConnection(connection));
}

export function logoutSeerr(): Promise<void> {
  const connection = useSeerrConnection.getState().connection;
  if (!connection) return Promise.resolve();
  const target = { ...connection };
  useSeerrConnection.getState().setConnection(null);
  // Revoking an old server session must never read or clear a newer connection.
  return changeSeerrSession(() =>
    fetchFromSeerr<void>(target, "/auth/logout", { method: "POST" }),
  );
}

export const getSeerrSettings = () =>
  seerrFetch<SeerrSettings>("/settings/public");
export const getSeerrQuota = (userId: number) =>
  seerrFetch<SeerrQuota>(`/user/${userId}/quota`);

export async function getSeerrPage(path: string, signal?: AbortSignal) {
  const page = await seerrFetch<SeerrPage>(path, { signal });
  return {
    ...page,
    results: page.results.filter(
      (item) => item.mediaType === "movie" || item.mediaType === "tv",
    ),
  };
}

export async function getSeerrDetails(
  id: number,
  mediaType: SeerrMediaType,
  signal?: AbortSignal,
) {
  const details = await seerrFetch<SeerrDetails>(`/${mediaType}/${id}`, {
    signal,
  });
  return { ...details, mediaType };
}

export async function requestSeerrMedia(
  media: SeerrMedia,
  seasons: number[] | undefined,
  expectedUserId: number,
) {
  if (media.mediaType === "tv" && !seasons?.length)
    throw new Error("Choose at least one season to request.");
  const context = captureConnection();
  const user = await fetchSeerrUser(context);
  if (user.id !== expectedUserId)
    throw new SeerrError(
      "Your Seerr account changed. Close this title and sign in again.",
      401,
    );
  return fetchFromSeerr<SeerrRequest>(
    context.connection,
    "/request",
    {
      method: "POST",
      body: JSON.stringify({
        mediaId: media.id,
        mediaType: media.mediaType,
        is4k: false,
        ...(media.mediaType === "tv" ? { seasons } : {}),
      }),
    },
    context,
  );
}

export function canRequestMedia(user: SeerrUser, type: SeerrMediaType) {
  const permission = type === "movie" ? 262144 : 524288;
  // Seerr encodes permissions as a bitmask.
  // eslint-disable-next-line no-bitwise
  return Boolean(user.permissions & (2 | 32 | permission));
}

export function seerrImage(path?: string | null, size = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}

export function seerrToMediaItem(media: SeerrMedia): MediaItem {
  const date = media.releaseDate || media.firstAirDate;
  return {
    id: String(media.id),
    title: media.title || media.name || "Untitled",
    type: media.mediaType === "movie" ? "movie" : "show",
    poster: seerrImage(media.posterPath, "w342"),
    year: date ? new Date(date).getFullYear() : undefined,
    release_date: date ? new Date(date) : undefined,
  };
}

export function seerrStatusLabel(status?: number) {
  if (status === 6) return "Blocked from requests";
  if (status === 7) return "Removed from library";
  if (status === 5) return "Available";
  if (status === 4) return "Partially available";
  if (status === 3) return "Requested";
  if (status === 2) return "Pending approval";
  return "Not in library";
}

export function seasonRequestStatus(details: SeerrDetails, season: number) {
  const existing = details.mediaInfo?.seasons?.find(
    (item) => item.seasonNumber === season,
  );
  if (existing && existing.status > 1 && existing.status !== 7)
    return existing.status;
  const requested = details.mediaInfo?.requests?.some(
    (request) =>
      !request.is4k &&
      [1, 2, 5].includes(request.status) &&
      request.seasons?.some((item) => item.seasonNumber === season),
  );
  return requested ? 3 : 1;
}
