// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, vi } from "vitest";

import { JellyfinSession } from "@/stores/jellyfin";

import {
  createSeerrConnection,
  getConfiguredSeerrServer,
  normalizeSeerrUrl,
} from "./servers";

const session: JellyfinSession = {
  serverUrl: "/jellyfin",
  userId: "library-user",
  userName: "Library user",
  accessToken: "library-session",
  deviceId: "test-client",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Seerr server setup", () => {
  it("uses the configured proxy for equivalent server and API addresses", () => {
    expect(
      createSeerrConnection(
        "server.local:5055/api/v1/",
        "http://server.local:5055",
        "jellyfin",
        session,
      ),
    ).toEqual({
      url: "http://server.local:5055",
      apiUrl: "/seerr/api/v1",
      authMethod: "jellyfin",
      jellyfinServerUrl: "/jellyfin",
      jellyfinUserId: "library-user",
      jellyfinAccessToken: "library-session",
    });
  });

  it("preserves an explicitly selected custom server and base path", () => {
    expect(
      createSeerrConnection(
        "https://other.example/requests/api/v1",
        "http://server.local:5055",
        "local",
        session,
      ),
    ).toMatchObject({
      url: "https://other.example/requests",
      apiUrl: "https://other.example/requests/api/v1",
      authMethod: "local",
    });
  });

  it.each([
    "",
    "ftp://example.test",
    // eslint-disable-next-line no-script-url -- Verify that executable URLs are rejected.
    "javascript:alert(1)",
    "https://user:password@example.test",
    "https://example.test?apiKey=secret",
    "https://example.test/#login",
  ])("rejects invalid or credential-bearing addresses: %s", (address) => {
    expect(() => normalizeSeerrUrl(address)).toThrow();
  });

  it("reads the public Seerr address without requesting a Seerr session", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ seerrUrl: "http://server.local:5055/" }),
    });
    vi.stubGlobal("fetch", fetch);
    await expect(getConfiguredSeerrServer()).resolves.toBe(
      "http://server.local:5055",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/server-config.json",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("allows manual setup if runtime configuration is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    await expect(getConfiguredSeerrServer()).resolves.toBeNull();
  });
});
