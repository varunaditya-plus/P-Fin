import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TraktServerStatus,
  getTraktServerStatus,
} from "@/backend/integrations/trakt";
import { JellyfinSession, useJellyfinAuth } from "@/stores/jellyfin";

import { TraktIntegrationSettings } from "./TraktIntegrationSettings";

vi.mock("@/backend/integrations/trakt", async (original) => ({
  ...(await original<typeof import("@/backend/integrations/trakt")>()),
  getTraktServerStatus: vi.fn(),
}));
const session: JellyfinSession = {
  serverUrl: "/jellyfin",
  serverAddress: "https://jellyfin.example/media",
  userId: "user",
  accessToken: "test",
  userName: "User",
  deviceId: "web",
};
const linked: TraktServerStatus = {
  administrator: true,
  plugin: "active",
  authorization: "linked",
  version: "30.0.0.0",
};
let host: HTMLDivElement;
let root: Root;
async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <TraktIntegrationSettings />
      </MemoryRouter>,
    ),
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  useJellyfinAuth.setState({ session });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Trakt settings", () => {
  it("shows server-managed authorisation without claiming scrobbling is enabled", async () => {
    vi.mocked(getTraktServerStatus).mockResolvedValue(linked);
    await render();
    expect(host.textContent).toContain("Account linked in Jellyfin");
    expect(host.textContent).toContain(
      "does not verify that those options are enabled",
    );
    expect(host.querySelector("a")?.href).toContain(
      "/media/web/index.html#!/configurationpage?name=trakt",
    );
    expect(host.querySelector("input")).toBeNull();
    expect(host.querySelector('[role="switch"]')).toBeNull();
  });

  it("offers retry after a failed status read", async () => {
    vi.mocked(getTraktServerStatus)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(linked);
    await render();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("Account linked in Jellyfin");
    expect(getTraktServerStatus).toHaveBeenCalledTimes(2);
  });

  it("clears the old account status and ignores pending results after an account switch", async () => {
    let resolve!: (value: TraktServerStatus) => void;
    vi.mocked(getTraktServerStatus)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce({
        administrator: false,
        plugin: "unavailable",
        authorization: "unknown",
      });
    await render();
    const signal = vi.mocked(getTraktServerStatus).mock.calls[0][1];
    await act(async () =>
      useJellyfinAuth.setState({ session: { ...session, userId: "other" } }),
    );
    await act(async () => resolve(linked));
    expect(signal?.aborted).toBe(true);
    expect(host.textContent).toContain("Administrator check needed");
    expect(host.textContent).not.toContain("Account linked in Jellyfin");
    expect(host.querySelector("a")).toBeNull();
  });
});
