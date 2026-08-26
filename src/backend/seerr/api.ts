import { getJellyfinSession } from "@/backend/jellyfin/client";
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

const apiBase = (import.meta.env.VITE_SEERR_API_URL || "/seerr/api/v1").replace(
  /\/$/,
  "",
);

export class SeerrError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SeerrError";
    this.status = status;
  }
}

export async function seerrFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
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
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new SeerrError(
        data?.message ||
          data?.error ||
          (response.status === 401
            ? "Sign in to Seerr to discover and request content."
            : "Seerr could not complete this request. Please try again."),
        response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    return await response.json();
  } catch (error) {
    if (timedOut)
      throw new SeerrError(
        "Seerr took too long to respond. Please try again.",
        504,
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

let sessionOperation: Promise<unknown> = Promise.resolve();
let pendingLogout: Promise<void> | undefined;

function changeSeerrSession<T>(operation: () => Promise<T>) {
  const result = sessionOperation.catch(() => undefined).then(operation);
  sessionOperation = result;
  return result;
}

// Serialize cookie mutations so an older logout cannot erase a newer sign-in.
// Seerr establishes its own HttpOnly session; passwords are never persisted.
export function authenticateSeerr(
  username: string,
  password: string,
  _jellyfinToken?: string,
) {
  return changeSeerrSession(() =>
    seerrFetch<SeerrUser>("/auth/jellyfin", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  );
}

export async function getSeerrUser() {
  const user = await seerrFetch<SeerrUser>("/auth/me");
  if (user.jellyfinUserId !== getJellyfinSession().userId)
    throw new SeerrError(
      "Sign in to Seerr with the same Jellyfin account you are using here.",
      401,
    );
  return user;
}
export function logoutSeerr() {
  if (!pendingLogout) {
    pendingLogout = changeSeerrSession(() =>
      seerrFetch<void>("/auth/logout", { method: "POST" }),
    ).finally(() => {
      pendingLogout = undefined;
    });
  }
  return pendingLogout;
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
  const user = await getSeerrUser();
  if (user.id !== expectedUserId)
    throw new SeerrError(
      "Your Seerr account changed. Close this title and sign in again.",
      401,
    );
  return seerrFetch<SeerrRequest>("/request", {
    method: "POST",
    body: JSON.stringify({
      mediaId: media.id,
      mediaType: media.mediaType,
      is4k: false,
      ...(media.mediaType === "tv" ? { seasons } : {}),
    }),
  });
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
