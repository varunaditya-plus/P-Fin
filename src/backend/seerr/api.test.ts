// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: () => ({ userId: "jellyfin-user" }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(body: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("Seerr integration", () => {
  it("waits for pending logout before authenticating so old cookies cannot erase the new session", async () => {
    let finishLogout: ((value: Response) => void) | undefined;
    const fetch = mockResponse({ id: 1, permissions: 2 });
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishLogout = resolve;
        }),
    );
    const logout = logoutSeerr();
    expect(logoutSeerr()).toBe(logout);
    const login = authenticateSeerr("test-user", "test-password");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/seerr/api/v1/auth/logout");
    finishLogout?.(new Response(null, { status: 204 }));
    await logout;
    await login;
    expect(fetch.mock.calls[1][0]).toBe("/seerr/api/v1/auth/jellyfin");
  });

  it("allows a new sign-in after an older logout fails", async () => {
    const fetch = mockResponse({ id: 1, permissions: 2 });
    fetch.mockRejectedValueOnce(new Error("Offline"));
    await expect(logoutSeerr()).rejects.toThrow("Offline");
    await expect(
      authenticateSeerr("test-user", "test-password"),
    ).resolves.toMatchObject({ id: 1 });
  });

  it("authenticates with an HttpOnly cookie session without exposing a Jellyfin token", async () => {
    const fetch = mockResponse({ id: 1, permissions: 2 });
    await authenticateSeerr("test-user", "test-password", "test-token");
    expect(fetch).toHaveBeenCalledWith(
      "/seerr/api/v1/auth/jellyfin",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify({
          username: "test-user",
          password: "test-password",
        }),
      }),
    );
  });

  it("submits only the selected TV seasons and uses Seerr's configured defaults", async () => {
    const fetch = mockResponse({ id: 10, status: 1 });
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        permissions: 2,
        jellyfinUserId: "jellyfin-user",
      }),
    });
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

  it("rejects a Seerr session belonging to a different Jellyfin user", async () => {
    mockResponse({ id: 1, permissions: 2, jellyfinUserId: "other-user" });
    await expect(getSeerrUser()).rejects.toMatchObject({ status: 401 });
  });

  it("rechecks the cookie session before creating a request", async () => {
    const fetch = mockResponse({
      id: 2,
      permissions: 2,
      jellyfinUserId: "jellyfin-user",
    });
    await expect(
      requestSeerrMedia({ id: 100, mediaType: "movie" }, undefined, 1),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/seerr/api/v1/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
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
