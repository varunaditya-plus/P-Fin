// Test runners are development dependencies.
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useJellyfinAuth, useJellyfinServers } from "@/stores/jellyfin";

import {
  findItemByProviderId,
  getEpisodes,
  getImageUrl,
  getLibraryItems,
  jellyfinRequest,
  loginJellyfin,
  logoutJellyfin,
} from "./client";

const session = {
  serverUrl: "/jellyfin",
  accessToken: "test-access-token",
  userId: "test-user",
  userName: "Test user",
  deviceId: "test-device",
};

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useJellyfinAuth.getState().setSession(session);
  useJellyfinServers.setState({ servers: [], selectedServer: null });
});

afterEach(() => {
  useJellyfinAuth.getState().setSession(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Jellyfin request boundaries", () => {
  it("sends authorization in a header and keeps tokens out of URLs", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      jellyfinRequest("Sessions/Playing", { method: "POST", body: "{}" }),
    ).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/jellyfin/Sessions/Playing");
    expect(String(url)).not.toContain(session.accessToken);
    expect(new Headers(init?.headers).get("Authorization")).toContain(
      `Token="${session.accessToken}"`,
    );
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("bounds default requests with a 30 second timeout", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await jellyfinRequest("Users/test-user");
    expect(timeout).toHaveBeenCalledWith(30000);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(timeoutSignal);
  });

  it("preserves a caller's cancellation or shorter timeout signal", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await jellyfinRequest("Items", { signal: controller.signal });
    expect(timeout).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("bounds authentication with a 30 second timeout", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);
    fetchMock.mockResolvedValue(
      jsonResponse({
        AccessToken: "bounded-token",
        User: { Id: "test-user", Name: "Example" },
      }),
    );
    await loginJellyfin("Example", "example-password");
    expect(timeout).toHaveBeenCalledWith(30000);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(timeoutSignal);
  });

  it("clears expired sessions but preserves a session after forbidden content", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(jellyfinRequest("private-item")).rejects.toThrow(
      "does not have access",
    );
    expect(useJellyfinAuth.getState().session).toEqual(session);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(jellyfinRequest("expired-item")).rejects.toThrow(
      "session expired",
    );
    expect(useJellyfinAuth.getState().session).toBeNull();
  });

  it("does not let an old unauthorized response clear a newer login", async () => {
    let finishRequest: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finishRequest = resolve;
      }),
    );
    const request = jellyfinRequest("old-session-request");
    const newSession = {
      ...session,
      accessToken: "new-account-token",
      userId: "new-account",
    };
    useJellyfinAuth.getState().setSession(newSession);
    finishRequest?.(new Response(null, { status: 401 }));
    await expect(request).rejects.toThrow("session expired");
    expect(useJellyfinAuth.getState().session).toEqual(newSession);
  });

  it("can sign in on LAN HTTP where randomUUID is unavailable", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(
        globalThis.crypto,
      ),
    });
    fetchMock.mockResolvedValue(
      jsonResponse({
        AccessToken: "lan-test-token",
        User: { Id: "lan-user", Name: "LAN user" },
      }),
    );
    const result = await loginJellyfin("Example", "example-password", false);
    expect(result.deviceId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(useJellyfinAuth.getState().session).toEqual(session);
  });

  it("authenticates against the selected server and retains its base path", async () => {
    useJellyfinServers.getState().saveServer({
      id: "remote-server",
      name: "Remote Jellyfin",
      url: "https://media.test/base",
      apiUrl: "https://media.test/base",
    });
    fetchMock.mockResolvedValue(
      jsonResponse({
        AccessToken: "remote-token",
        User: { Id: "remote-user", Name: "Example" },
      }),
    );
    const result = await loginJellyfin("Example", "example-password", false);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://media.test/base/Users/AuthenticateByName",
    );
    expect(result).toMatchObject({
      serverUrl: "https://media.test/base",
      serverId: "remote-server",
      serverName: "Remote Jellyfin",
    });
    expect(useJellyfinAuth.getState().session).toEqual(session);
  });

  it("stores only returned session data after login", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        AccessToken: "new-test-token",
        User: { Id: "signed-in-user", Name: "Example" },
      }),
    );
    await loginJellyfin("Example", "example-password");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      Username: "Example",
      Pw: "example-password",
    });
    expect(useJellyfinAuth.getState().session).toMatchObject({
      userId: "signed-in-user",
      userName: "Example",
      accessToken: "new-test-token",
    });
    expect(JSON.stringify(useJellyfinAuth.getState())).not.toContain(
      "example-password",
    );
  });

  it("clears local authentication even when server logout fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network unavailable"));
    await expect(logoutJellyfin()).rejects.toThrow("Network unavailable");
    expect(useJellyfinAuth.getState().session).toBeNull();
  });

  it("signs out immediately and never clears a newer login when the old logout completes", async () => {
    let finishRequest: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finishRequest = resolve;
      }),
    );
    const logout = logoutJellyfin();
    expect(useJellyfinAuth.getState().session).toBeNull();
    const newSession = {
      ...session,
      accessToken: "new-token",
      userId: "new-user",
    };
    useJellyfinAuth.getState().setSession(newSession);
    finishRequest?.(new Response(null, { status: 204 }));
    await logout;
    expect(useJellyfinAuth.getState().session).toEqual(newSession);
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"),
    ).toContain(session.accessToken);
  });

  it("bounds an unresponsive server logout after clearing local authentication", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
      const logout = logoutJellyfin();
      const rejection = expect(logout).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(useJellyfinAuth.getState().session).toBeNull();
      await vi.advanceTimersByTimeAsync(5000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Jellyfin user-visible catalog", () => {
  it("paginates inside the selected user's library", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ Items: [], TotalRecordCount: 99 }),
    );
    await getLibraryItems("movie-library", 60);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/jellyfin/Users/test-user/Items");
    expect(url.searchParams.get("ParentId")).toBe("movie-library");
    expect(url.searchParams.get("StartIndex")).toBe("60");
    expect(url.searchParams.get("IncludeItemTypes")).toBe("Movie,Series");
  });

  it("retains the actual season ID including specials and scopes episodes to the user", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ Items: [] }));
    await getEpisodes("series-id", "specials-season-id");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/jellyfin/Shows/series-id/Episodes");
    expect(url.searchParams.get("SeasonId")).toBe("specials-season-id");
    expect(url.searchParams.get("UserId")).toBe(session.userId);
  });

  it("keeps missing and virtual episodes out of playable season contents", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        Items: [
          { Id: "available", Name: "Episode", Type: "Episode" },
          {
            Id: "missing",
            Name: "Missing episode",
            Type: "Episode",
            IsMissing: true,
          },
          {
            Id: "virtual",
            Name: "Future episode",
            Type: "Episode",
            IsVirtualItem: true,
          },
        ],
      }),
    );
    await expect(getEpisodes("series-id", "season-id")).resolves.toEqual([
      { Id: "available", Name: "Episode", Type: "Episode" },
    ]);
  });

  it("finds provider matches beyond the first page without trusting an unsupported filter", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        Items: [
          {
            Id: "unrelated",
            Name: "A movie",
            Type: "Movie",
            ProviderIds: { Tmdb: "10" },
          },
        ],
        TotalRecordCount: 2,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        Items: [
          {
            Id: "match",
            Name: "Z movie",
            Type: "Movie",
            ProviderIds: { Tmdb: "20" },
          },
        ],
        TotalRecordCount: 2,
      }),
    );
    await expect(findItemByProviderId(20, "movie")).resolves.toMatchObject({
      Id: "match",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = new URL(String(fetchMock.mock.calls[1][0]));
    expect(second.pathname).toBe("/jellyfin/Users/test-user/Items");
    expect(second.searchParams.get("StartIndex")).toBe("1");
    expect(second.searchParams.has("AnyProviderIdEquals")).toBe(false);
  });

  it("does not make an unavailable title playable", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        Items: [
          {
            Id: "unrelated",
            Name: "A movie",
            Type: "Movie",
            ProviderIds: { Tmdb: "10" },
          },
        ],
        TotalRecordCount: 1,
      }),
    );
    await expect(findItemByProviderId(999, "movie")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses parent artwork for episodes and omits nonexistent images", () => {
    const item = {
      Id: "episode",
      Name: "Pilot",
      Type: "Episode",
      SeriesId: "series",
      SeriesPrimaryImageTag: "poster-tag",
      ParentBackdropItemId: "series",
      ParentBackdropImageTags: ["backdrop-tag"],
    };
    expect(getImageUrl(item, "Primary")).toContain(
      "/Items/series/Images/Primary",
    );
    expect(getImageUrl(item, "Backdrop")).toContain(
      "/Items/series/Images/Backdrop/0",
    );
    expect(getImageUrl(item, "Logo")).toBeUndefined();
  });
});
