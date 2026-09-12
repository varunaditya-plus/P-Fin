// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import { JellyfinSession, useJellyfinAuth } from "@/stores/jellyfin";

import {
  TRAKT_PLUGIN_ID,
  getTraktServerStatus,
  traktJellyfinSettingsUrl,
} from "./trakt";

vi.mock("@/backend/jellyfin/client", () => ({ jellyfinRequest: vi.fn() }));
const session: JellyfinSession = {
  serverUrl: "/jellyfin",
  serverAddress: "https://jellyfin.example/media",
  userId: "user",
  accessToken: "test",
  userName: "User",
  deviceId: "web",
};
const activePlugin = {
  Id: TRAKT_PLUGIN_ID,
  Version: "30.0.0.0",
  Status: "Active",
};

beforeEach(() => {
  vi.resetAllMocks();
  useJellyfinAuth.setState({ session });
});

describe("server-managed Trakt", () => {
  it("does not request administrative endpoints for a regular user", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({
      Policy: { IsAdministrator: false },
    });
    expect(await getTraktServerStatus(session)).toEqual({
      administrator: false,
      plugin: "unavailable",
      authorization: "unknown",
    });
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
    expect(jellyfinRequest).toHaveBeenCalledWith("Users/user", {
      signal: undefined,
    });
  });

  it("reads only this user's boolean status and never global configuration or Trakt writes", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { IsAdministrator: true } })
      .mockResolvedValueOnce([
        { ...activePlugin, Version: "99.0.0.0", Status: "Superseded" },
        activePlugin,
      ])
      .mockResolvedValueOnce({ isAuthorized: true });
    const signal = new AbortController().signal;
    expect(await getTraktServerStatus(session, signal)).toMatchObject({
      plugin: "active",
      version: "30.0.0.0",
      authorization: "linked",
    });
    expect(vi.mocked(jellyfinRequest).mock.calls).toEqual([
      ["Users/user", { signal }],
      ["Plugins", { signal }],
      ["Trakt/Users/user/PollAuthorizationStatus", { signal }],
    ]);
  });

  it("reports a missing plugin without probing its endpoints", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { IsAdministrator: true } })
      .mockResolvedValueOnce([{ Id: "different-plugin", Name: "Trakt" }]);
    expect(await getTraktServerStatus(session)).toMatchObject({
      plugin: "missing",
      authorization: "unknown",
    });
    expect(jellyfinRequest).toHaveBeenCalledTimes(2);
  });

  it("does not treat a disabled or restarting plugin as running", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { IsAdministrator: true } })
      .mockResolvedValueOnce([{ ...activePlugin, Status: "Restart" }]);
    expect(await getTraktServerStatus(session)).toMatchObject({
      plugin: "inactive",
      pluginState: "Restart",
      authorization: "unknown",
    });
    expect(jellyfinRequest).toHaveBeenCalledTimes(2);
  });

  it("keeps an unsupported/unconfigured user's link status unknown", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { IsAdministrator: true } })
      .mockResolvedValueOnce([activePlugin])
      .mockRejectedValueOnce(new Error("500"));
    expect(await getTraktServerStatus(session)).toMatchObject({
      plugin: "active",
      authorization: "unknown",
    });
  });

  it("only reports unlinked when the plugin explicitly returns false", async () => {
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { IsAdministrator: true } })
      .mockResolvedValueOnce([activePlugin])
      .mockResolvedValueOnce({ isAuthorized: false });
    expect((await getTraktServerStatus(session)).authorization).toBe(
      "unlinked",
    );
  });

  it("rejects stale account responses before issuing any follow-up request", async () => {
    vi.mocked(jellyfinRequest).mockImplementationOnce(async () => {
      useJellyfinAuth.setState({ session: { ...session, userId: "other" } });
      return { Policy: { IsAdministrator: true } };
    });
    await expect(getTraktServerStatus(session)).rejects.toThrow(
      "account changed",
    );
    expect(jellyfinRequest).toHaveBeenCalledTimes(1);
  });

  it("does not swallow an aborted link-status check", async () => {
    const controller = new AbortController();
    vi.mocked(jellyfinRequest)
      .mockResolvedValueOnce({ Policy: { IsAdministrator: true } })
      .mockResolvedValueOnce([activePlugin])
      .mockImplementationOnce(async () => {
        controller.abort();
        throw new Error("aborted");
      });
    await expect(
      getTraktServerStatus(session, controller.signal),
    ).rejects.toThrow();
  });

  it("preserves the server base path and never puts credentials in settings links", () => {
    const link = traktJellyfinSettingsUrl(session)!;
    expect(link).toBe(
      "https://jellyfin.example/media/web/index.html#!/configurationpage?name=trakt",
    );
    expect(new URL(link).search).toBe("");
    expect(traktJellyfinSettingsUrl(session, false)).toContain(
      "#!/dashboard/plugins",
    );
    expect(
      traktJellyfinSettingsUrl({ ...session, serverAddress: undefined }),
    ).toBeNull();
    expect(
      traktJellyfinSettingsUrl({
        ...session,
        serverAddress: "https://user:password@example.com",
      }),
    ).toBeNull();
  });
});
