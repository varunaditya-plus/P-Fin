// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useJellyfinAuth, useJellyfinServers } from "@/stores/jellyfin";
import {
  SeerrConnection,
  matchesSeerrSession,
  useSeerrConnection,
} from "@/stores/seerr";

import {
  SeerrError,
  authenticateSeerr,
  canRequestMedia,
  getSeerrPage,
  getSeerrUser,
  logoutSeerr,
  requestSeerrMedia,
  seasonRequestStatus,
  seerrFetch,
} from "./api";
import { SeerrDetails } from "./types";

const jellyfinSession = {
  serverUrl: "/jellyfin",
  userId: "jellyfin-user",
  accessToken: "test-token",
  userName: "Test user",
  deviceId: "test-device",
};
const configuredConnection: SeerrConnection = {
  url: "http://seerr.example:5055",
  apiUrl: "/seerr/api/v1",
  authMethod: "jellyfin",
  jellyfinServerUrl: jellyfinSession.serverUrl,
  jellyfinUserId: jellyfinSession.userId,
  jellyfinAccessToken: jellyfinSession.accessToken,
  userId: 1,
};
const validUser = {
  id: 1,
  permissions: 2,
  jellyfinUserId: jellyfinSession.userId,
};

beforeEach(() => {
  useJellyfinAuth.getState().setSession(jellyfinSession);
  useJellyfinServers.getState().selectServer({
    id: "configured",
    name: "Server",
    url: "http://jellyfin.example",
    apiUrl: "/jellyfin",
  });
  useSeerrConnection.getState().setConnection({ ...configuredConnection });
});

afterEach(() => {
  useSeerrConnection.getState().setConnection(null);
  useJellyfinAuth.getState().setSession(null);
  useJellyfinServers.getState().selectServer(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockResponse(body: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function deferredResponse(fetch: ReturnType<typeof mockResponse>) {
  let complete: ((value: Response) => void) | undefined;
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  return (response: Response) => complete?.(response);
}

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Seerr opt-in and session boundaries", () => {
  it("makes no Seerr requests until a connection is explicitly configured", async () => {
    const fetch = mockResponse({});
    useSeerrConnection.getState().setConnection(null);
    await expect(authenticateSeerr("test", "password")).rejects.toMatchObject({
      status: 403,
    });
    await expect(getSeerrUser()).rejects.toMatchObject({ status: 403 });
    await expect(getSeerrPage("/discover/movies")).rejects.toMatchObject({
      status: 403,
    });
    await logoutSeerr();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { serverUrl: "https://other.example" },
    { userId: "other-user" },
    { accessToken: "other-token" },
  ])(
    "rejects a connection bound to a different Jellyfin session: %s",
    async (change) => {
      const fetch = mockResponse({});
      useJellyfinAuth.getState().setSession({ ...jellyfinSession, ...change });
      expect(
        matchesSeerrSession(
          configuredConnection,
          useJellyfinAuth.getState().session,
        ),
      ).toBe(false);
      await expect(seerrFetch("/discover/movies")).rejects.toMatchObject({
        status: 401,
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("accepts an explicitly chosen custom Seerr server for a custom Jellyfin session", async () => {
    const session = {
      ...jellyfinSession,
      serverUrl: "https://jellyfin.custom.example/base",
    };
    const connection = {
      ...configuredConnection,
      url: "https://seerr.custom.example/base",
      apiUrl: "https://seerr.custom.example/base/api/v1",
      jellyfinServerUrl: session.serverUrl,
    };
    useJellyfinAuth.getState().setSession(session);
    useSeerrConnection.getState().setConnection(connection);
    const fetch = mockResponse(validUser);
    await getSeerrUser();
    expect(fetch).toHaveBeenCalledWith(
      "/seerr/api/v1/auth/me",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "X-Seerr-Upstream": "https://seerr.custom.example/base",
        }),
      }),
    );
  });

  it("allows explicit setup before publishing the pending Jellyfin session without persisting credentials", async () => {
    useJellyfinAuth.getState().setSession(null);
    useSeerrConnection.getState().setConnection(null);
    const fetch = mockResponse(validUser);
    await authenticateSeerr("test-user", "test-password", configuredConnection);
    await getSeerrUser(configuredConnection);
    expect(fetch.mock.calls[0]).toEqual([
      "/seerr/api/v1/auth/jellyfin",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify({
          username: "test-user",
          password: "test-password",
          email: "test-user",
        }),
      }),
    ]);
    expect(useSeerrConnection.getState().connection).toBeNull();
    expect(sessionStorage.getItem("seerr-connection")).not.toContain(
      "test-password",
    );
  });

  it("uses email/password for explicitly selected local Seerr authentication", async () => {
    const connection: SeerrConnection = {
      ...configuredConnection,
      authMethod: "local",
      userId: undefined,
    };
    const fetch = mockResponse({ id: 20, permissions: 32 });
    await authenticateSeerr("local@example.com", "test-password", connection);
    await expect(getSeerrUser(connection)).resolves.toMatchObject({ id: 20 });
    expect(fetch.mock.calls[0]).toEqual([
      "/seerr/api/v1/auth/local",
      expect.objectContaining({
        body: JSON.stringify({
          email: "local@example.com",
          password: "test-password",
        }),
      }),
    ]);
  });

  it("checks linked Jellyfin identity only for Jellyfin authentication", async () => {
    mockResponse({ id: 1, permissions: 2, jellyfinUserId: "other-user" });
    await expect(getSeerrUser()).rejects.toMatchObject({ status: 401 });
    useSeerrConnection
      .getState()
      .setConnection({ ...configuredConnection, authMethod: "local" });
    await expect(getSeerrUser()).resolves.toMatchObject({ id: 1 });
  });

  it("rejects a changed Seerr cookie user even when local login was selected", async () => {
    useSeerrConnection
      .getState()
      .setConnection({ ...configuredConnection, authMethod: "local" });
    mockResponse({ id: 2, permissions: 2 });
    await expect(getSeerrUser()).rejects.toMatchObject({ status: 401 });
  });

  it("clears the connection synchronously and logs out the captured old target", async () => {
    const fetch = mockResponse(undefined, 204);
    const finish = deferredResponse(fetch);
    const logout = logoutSeerr();
    expect(useSeerrConnection.getState().connection).toBeNull();
    const replacement = {
      ...configuredConnection,
      url: "https://new.example",
      apiUrl: "https://new.example/api/v1",
    };
    useSeerrConnection.getState().setConnection(replacement);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/seerr/api/v1/auth/logout");
    finish(new Response(null, { status: 204 }));
    await logout;
    expect(useSeerrConnection.getState().connection).toEqual(replacement);
  });

  it("waits for old logout before new login and never redirects queued credentials", async () => {
    const fetch = mockResponse(validUser);
    const finish = deferredResponse(fetch);
    const logout = logoutSeerr();
    const connection = {
      ...configuredConnection,
      url: "https://chosen.example",
      apiUrl: "https://chosen.example/api/v1",
    };
    const login = authenticateSeerr("test-user", "test-password", connection);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    finish(new Response(null, { status: 204 }));
    await logout;
    await login;
    expect(fetch.mock.calls[1][0]).toBe("/seerr/api/v1/auth/jellyfin");
    expect(fetch.mock.calls[0][1].headers["X-Seerr-Upstream"]).toBe(
      "http://seerr.example:5055",
    );
    expect(fetch.mock.calls[1][1].headers["X-Seerr-Upstream"]).toBe(
      "https://chosen.example",
    );
  });

  it("stops queued authentication when the Jellyfin account changes", async () => {
    const fetch = mockResponse(validUser);
    const finish = deferredResponse(fetch);
    const logout = logoutSeerr();
    const login = authenticateSeerr(
      "test-user",
      "test-password",
      configuredConnection,
    );
    const rejection = expect(login).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    useJellyfinAuth
      .getState()
      .setSession({ ...jellyfinSession, accessToken: "new-token" });
    finish(new Response(null, { status: 204 }));
    await logout;
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops pending setup credentials when the selected Jellyfin server changes", async () => {
    const fetch = mockResponse(validUser);
    const finish = deferredResponse(fetch);
    const logout = logoutSeerr();
    useJellyfinAuth.getState().setSession(null);
    const login = authenticateSeerr(
      "test-user",
      "test-password",
      configuredConnection,
    );
    const rejection = expect(login).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    useJellyfinServers.getState().selectServer({
      id: "other",
      name: "Other",
      url: "https://other.example",
      apiUrl: "https://other.example",
    });
    finish(new Response(null, { status: 204 }));
    await logout;
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("allows explicit login after an older logout fails", async () => {
    const fetch = mockResponse(validUser);
    fetch.mockRejectedValueOnce(new Error("Offline"));
    await expect(logoutSeerr()).rejects.toThrow("Offline");
    await expect(
      authenticateSeerr("test-user", "test-password", configuredConnection),
    ).resolves.toMatchObject({ id: 1 });
  });

  it("reports when the same-origin Seerr proxy cannot be reached", async () => {
    const fetch = mockResponse({});
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(seerrFetch("/auth/me")).rejects.toThrow("Seerr proxy");
  });

  it("bounds an unresponsive Seerr request", async () => {
    vi.useFakeTimers();
    const fetch = mockResponse({});
    fetch.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const request = seerrFetch("/auth/me");
    const rejection = expect(request).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(15000);
    await rejection;
  });
});

describe("Seerr request integration", () => {
  it("submits selected TV seasons using the verified connection and Seerr defaults", async () => {
    const fetch = mockResponse({ id: 10, status: 1 });
    fetch.mockResolvedValueOnce(response(validUser));
    await requestSeerrMedia({ id: 1396, mediaType: "tv" }, [2, 4], 1);
    expect(fetch).toHaveBeenCalledWith(
      "/seerr/api/v1/request",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          mediaId: 1396,
          mediaType: "tv",
          is4k: false,
          seasons: [2, 4],
        }),
      }),
    );
  });

  it("rejects empty season requests before sending them", async () => {
    const fetch = mockResponse({});
    await expect(
      requestSeerrMedia({ id: 1396, mediaType: "tv" }, [], 1),
    ).rejects.toThrow("Choose at least one season");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rechecks the cookie session before creating a request", async () => {
    const fetch = mockResponse({ ...validUser, id: 2 });
    await expect(
      requestSeerrMedia({ id: 100, mediaType: "movie" }, undefined, 1),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("never posts to a changed connection after an account-check response", async () => {
    const fetch = mockResponse(validUser);
    const finish = deferredResponse(fetch);
    const request = requestSeerrMedia(
      { id: 100, mediaType: "movie" },
      undefined,
      1,
    );
    const rejection = expect(request).rejects.toMatchObject({ status: 401 });
    useSeerrConnection.getState().setConnection({
      ...configuredConnection,
      apiUrl: "https://other.example/api/v1",
    });
    finish(response(validUser));
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps movie and TV permissions separate, while allowing administrators", () => {
    expect(canRequestMedia({ id: 1, permissions: 262144 }, "movie")).toBe(true);
    expect(canRequestMedia({ id: 1, permissions: 262144 }, "tv")).toBe(false);
    expect(canRequestMedia({ id: 1, permissions: 524288 }, "tv")).toBe(true);
    expect(canRequestMedia({ id: 1, permissions: 2 }, "tv")).toBe(true);
    expect(canRequestMedia({ id: 1, permissions: 0 }, "movie")).toBe(false);
  });

  it("blocks available and active requested seasons, but allows declined requests to be retried", () => {
    const details: SeerrDetails = {
      id: 1396,
      mediaType: "tv",
      mediaInfo: {
        status: 4,
        seasons: [{ seasonNumber: 1, status: 5 }],
        requests: [
          {
            id: 1,
            type: "tv",
            status: 1,
            seasons: [{ seasonNumber: 2, status: 1 }],
          },
          {
            id: 2,
            type: "tv",
            status: 3,
            seasons: [{ seasonNumber: 3, status: 3 }],
          },
          {
            id: 3,
            type: "tv",
            status: 2,
            is4k: true,
            seasons: [{ seasonNumber: 4, status: 2 }],
          },
        ],
      },
    };
    expect(seasonRequestStatus(details, 1)).toBe(5);
    expect(seasonRequestStatus(details, 2)).toBe(3);
    expect(seasonRequestStatus(details, 3)).toBe(1);
    expect(seasonRequestStatus(details, 4)).toBe(1);
  });

  it("filters people out of search results instead of treating them as playable titles", async () => {
    mockResponse({
      page: 1,
      totalPages: 1,
      totalResults: 3,
      results: [
        { id: 1, mediaType: "person" },
        { id: 2, mediaType: "movie" },
        { id: 3, mediaType: "tv" },
      ],
    });
    expect(
      (await getSeerrPage("/search?query=test")).results.map((item) => item.id),
    ).toEqual([2, 3]);
  });

  it("preserves authentication failures and server request errors for the UI", async () => {
    mockResponse({ message: "Request limit reached" }, 403);
    await expect(seerrFetch("/request")).rejects.toEqual(
      new SeerrError("Request limit reached", 403),
    );
  });
});
