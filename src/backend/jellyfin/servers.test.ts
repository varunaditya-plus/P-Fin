// Test runners are development dependencies.
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useJellyfinServers } from "@/stores/jellyfin";

import {
  connectJellyfinServer,
  getConfiguredJellyfinServer,
  getServerLogin,
  normalizeServerUrl,
} from "./servers";

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
const respond = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useJellyfinServers.setState({ servers: [], selectedServer: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useJellyfinServers.setState({ servers: [], selectedServer: null });
});

describe("Jellyfin server onboarding", () => {
  it("normalizes addresses while retaining reverse proxy base paths", () => {
    expect(normalizeServerUrl(" 100.64.96.96:8096/ ")).toBe(
      "http://100.64.96.96:8096",
    );
    expect(
      normalizeServerUrl(
        "https://media.test/jellyfin/web/index.html#!/login.html",
      ),
    ).toBe("https://media.test/jellyfin");
    expect(normalizeServerUrl("https://media.test/jellyfin/")).toBe(
      "https://media.test/jellyfin",
    );
  });

  it("rejects credentials, unsafe protocols and accidental query URLs", () => {
    expect(() =>
      normalizeServerUrl("https://user:password@media.test"),
    ).toThrow("without a username");
    expect(() => normalizeServerUrl("file:///tmp/jellyfin")).toThrow(
      "HTTP or HTTPS",
    );
    expect(() =>
      normalizeServerUrl("https://media.test?api_key=secret"),
    ).toThrow("without a query");
  });

  it("routes the configured address through the local proxy", async () => {
    fetchMock.mockResolvedValue(
      respond({ Id: "server-id", ServerName: "My library", Version: "12.0.0" }),
    );
    await expect(
      connectJellyfinServer(
        "http://100.64.96.96:8096/",
        "http://100.64.96.96:8096",
      ),
    ).resolves.toMatchObject({
      apiUrl: "/jellyfin",
      url: "http://100.64.96.96:8096",
      name: "My library",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/jellyfin/System/Info/Public",
    );
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("omit");
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).has("Authorization"),
    ).toBe(false);
  });

  it("validates a custom server directly before saving it", async () => {
    fetchMock.mockResolvedValue(
      respond({ Id: "remote-id", ServerName: "Remote" }),
    );
    const server = await connectJellyfinServer("https://media.test/base");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://media.test/base/System/Info/Public",
    );
    expect(server.apiUrl).toBe("https://media.test/base");
    expect(useJellyfinServers.getState().servers).toEqual([]);
  });

  it("rejects a successful non-Jellyfin response", async () => {
    fetchMock.mockResolvedValue(respond({ message: "unrelated service" }));
    await expect(connectJellyfinServer("https://media.test")).rejects.toThrow(
      "No Jellyfin server",
    );
  });

  it("explains mixed-content failures before making a direct request", async () => {
    vi.stubGlobal("window", {
      location: { protocol: "https:", origin: "https://client.test" },
    });
    await expect(
      connectJellyfinServer("http://192.168.1.10:8096"),
    ).rejects.toThrow("cannot connect directly to an HTTP server");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads runtime proxy configuration rather than baking a server into the client", async () => {
    fetchMock.mockResolvedValue(
      respond({ jellyfinUrl: "http://100.64.96.96:8096/" }),
    );
    await expect(getConfiguredJellyfinServer()).resolves.toBe(
      "http://100.64.96.96:8096",
    );
    expect(fetchMock.mock.calls[0][0]).toBe("/server-config.json");
  });

  it("loads public users including passwordless accounts", async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond([{ Id: "guest", Name: "Guest", HasPassword: false }]),
      )
      .mockResolvedValueOnce(respond({ LoginDisclaimer: "Welcome" }));
    await expect(
      getServerLogin({
        id: "server",
        name: "Server",
        url: "http://media.test",
        apiUrl: "/jellyfin",
      }),
    ).resolves.toEqual({
      users: [{ Id: "guest", Name: "Guest", HasPassword: false }],
      disclaimer: "Welcome",
    });
  });

  it("refreshes the address of a known server without adding duplicates", () => {
    useJellyfinServers.getState().saveServer({
      id: "server",
      name: "Server",
      url: "http://old.test",
      apiUrl: "http://old.test",
    });
    useJellyfinServers.getState().saveServer({
      id: "server",
      name: "Server",
      url: "http://new.test",
      apiUrl: "/jellyfin",
    });
    expect(useJellyfinServers.getState().servers).toHaveLength(1);
    expect(useJellyfinServers.getState().selectedServer?.url).toBe(
      "http://new.test",
    );
    useJellyfinServers.getState().removeServer("server");
    expect(useJellyfinServers.getState().selectedServer).toBeNull();
  });
});
