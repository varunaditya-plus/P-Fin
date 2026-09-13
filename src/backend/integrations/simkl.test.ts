/* eslint-disable import/no-extraneous-dependencies */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSimklConnection } from "@/stores/integrations/simkl";
import { useJellyfinAuth } from "@/stores/jellyfin";

import { integrationIdentity } from "./library";
import {
  disconnectSimkl,
  pollSimklConnection,
  simklRequest,
  startSimklConnection,
} from "./simkl";

const session = {
  serverUrl: "/jellyfin",
  userId: "user",
  accessToken: "test-jellyfin",
  userName: "User",
  deviceId: "test",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
beforeEach(() => {
  useSimklConnection.getState().setConnection(null);
  useJellyfinAuth.getState().setSession(session);
  vi.restoreAllMocks();
});

describe("Simkl public device connection", () => {
  it("requests write scopes without an application secret and preserves polling errors", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        json({ device_code: "device", user_code: "ABCD-EFGH" }),
      )
      .mockResolvedValueOnce(json({ error: "slow_down" }, 400));
    await startSimklConnection("public-client");
    expect(String(fetcher.mock.calls[0][0])).toContain("app-name=movie-fin");
    expect(String(fetcher.mock.calls[0][1]?.body)).toContain(
      "scope=media%3Aread+media%3Awrite",
    );
    expect(String(fetcher.mock.calls[0][1]?.body)).not.toContain("secret");
    await expect(
      pollSimklConnection("public-client", "device", integrationIdentity()),
    ).rejects.toMatchObject({ code: "slow_down" });
  });
  it("keeps only the access token in memory and verifies the account before publishing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        json({
          access_token: "test-access",
          refresh_token: "never-persist",
          expires_in: 1000,
          scope: "media:read media:write",
        }),
      )
      .mockResolvedValueOnce(
        json({ user: { name: "Simkl user" }, account: { id: 9 } }),
      );
    const connection = await pollSimklConnection(
      "public-client",
      "device",
      integrationIdentity(),
    );
    expect(connection.profile).toEqual({ id: 9, name: "Simkl user" });
    expect(JSON.stringify(connection)).not.toContain("never-persist");
    expect(JSON.stringify(localStorage)).not.toContain("test-access");
    expect(JSON.stringify(sessionStorage)).not.toContain("test-access");
  });
  it("rejects a stale account during device authentication", async () => {
    const identity = integrationIdentity();
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
      useJellyfinAuth.getState().setSession({ ...session, userId: "other" });
      return json({
        access_token: "test-access",
        expires_in: 100,
        scope: "media:read",
      });
    });
    await expect(
      pollSimklConnection("public-client", "device", identity),
    ).rejects.toThrow("account changed");
    expect(useSimklConnection.getState().connection).toBeNull();
  });
  it("clears a captured connection immediately and cannot clear a later connection", async () => {
    const identity = integrationIdentity();
    const original = {
      clientId: "public",
      accessToken: "old",
      expiresAt: Date.now() + 10000,
      scopes: "media:read",
      profile: { id: 1, name: "A" },
      jellyfinScope: identity.scope,
      jellyfinToken: identity.token,
    };
    useSimklConnection.getState().setConnection(original);
    let finish!: (response: Response) => void;
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = disconnectSimkl();
    expect(useSimklConnection.getState().connection).toBeNull();
    const newer = { ...original, accessToken: "new" };
    useSimklConnection.getState().setConnection(newer);
    finish(json({}));
    await pending;
    expect(useSimklConnection.getState().connection).toBe(newer);
    expect(String(fetcher.mock.calls[0][1]?.body)).toContain("token=old");
    await expect(
      simklRequest("/sync/history", { method: "POST" }),
    ).rejects.toThrow("read-only");
  });
});
