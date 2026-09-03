import { ReactNode, act } from "react";
import { Root, createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useLocation } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginJellyfin } from "@/backend/jellyfin/client";
import {
  connectJellyfinServer,
  getConfiguredJellyfinServer,
  getServerLogin,
} from "@/backend/jellyfin/servers";
import {
  authenticateSeerr,
  getSeerrUser,
  logoutSeerr,
} from "@/backend/seerr/api";
import { getConfiguredSeerrServer } from "@/backend/seerr/servers";
import {
  JellyfinServer,
  useJellyfinAuth,
  useJellyfinServers,
} from "@/stores/jellyfin";
import { useSeerrConnection } from "@/stores/seerr";

import { JellyfinLogin } from "./JellyfinLogin";

vi.mock("@/backend/jellyfin/client", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/client")>()),
  loginJellyfin: vi.fn(),
}));
vi.mock("@/backend/jellyfin/servers", async (original) => ({
  ...(await original<typeof import("@/backend/jellyfin/servers")>()),
  connectJellyfinServer: vi.fn(),
  getConfiguredJellyfinServer: vi.fn(),
  getServerLogin: vi.fn(),
}));
vi.mock("@/backend/seerr/api", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/api")>()),
  authenticateSeerr: vi.fn(),
  getSeerrUser: vi.fn(),
  logoutSeerr: vi.fn(),
}));
vi.mock("@/pages/layouts/SubPageLayout", () => ({
  SubPageLayout: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/backend/seerr/servers", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/servers")>()),
  getConfiguredSeerrServer: vi.fn(),
}));

const server: JellyfinServer = {
  id: "server-id",
  name: "Library",
  url: "http://library.test:8096",
  apiUrl: "/jellyfin",
};
const session: Awaited<ReturnType<typeof loginJellyfin>> = {
  serverUrl: "/jellyfin",
  serverId: server.id,
  serverName: server.name,
  serverAddress: server.url,
  userId: "jellyfin-user",
  userName: "Library user",
  accessToken: "test-token",
  deviceId: "test-device",
};
let root: Root;
let container: HTMLDivElement;

function Location() {
  const location = useLocation();
  return <output data-location>{location.pathname}</output>;
}

async function render(from = "/discover") {
  await act(async () =>
    root.render(
      <MemoryRouter
        initialEntries={[{ pathname: "/login", state: { from } }]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <HelmetProvider>
          <Location />
          <JellyfinLogin />
        </HelmetProvider>
      </MemoryRouter>,
    ),
  );
}

async function fill(label: string, value: string) {
  const labelElement = [...container.querySelectorAll("label")].find(
    (element) => element.textContent?.trim() === label,
  );
  const input = document.getElementById(
    labelElement?.htmlFor ?? "",
  ) as HTMLInputElement | null;
  expect(input, `Missing input ${label}`).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === text,
  );
  expect(button, `Missing button ${text}`).toBeDefined();
  await act(async () => button!.click());
}

async function connect() {
  await fill("Server address", server.url);
  await click("Connect");
}

function expectPendingChoice() {
  expect(container.textContent).toContain("Enable Seerr?");
  expect(useJellyfinAuth.getState().session).toBeNull();
  expect(container.querySelector("[data-location]")?.textContent).toBe(
    "/login",
  );
  expect(authenticateSeerr).not.toHaveBeenCalled();
  expect(getSeerrUser).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn());
  useJellyfinAuth.setState({ session: null });
  useJellyfinServers.setState({ servers: [], selectedServer: null });
  useSeerrConnection.setState({ connection: null });
  vi.mocked(getConfiguredJellyfinServer).mockResolvedValue(server.url);
  vi.mocked(connectJellyfinServer).mockResolvedValue(server);
  vi.mocked(getServerLogin).mockResolvedValue({ users: [] });
  vi.mocked(loginJellyfin).mockResolvedValue(session);
  vi.mocked(logoutSeerr).mockResolvedValue(undefined);
  vi.mocked(getConfiguredSeerrServer).mockResolvedValue(
    "http://requests.test:5055",
  );
  vi.mocked(authenticateSeerr).mockResolvedValue({ id: 21, permissions: 2 });
  vi.mocked(getSeerrUser).mockResolvedValue({ id: 21, permissions: 2 });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useJellyfinAuth.setState({ session: null });
  useJellyfinServers.setState({ servers: [], selectedServer: null });
  useSeerrConnection.setState({ connection: null });
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("Jellyfin login's optional Seerr step", () => {
  it("withholds the session until the user skips, without logging into Seerr", async () => {
    useSeerrConnection.setState({
      connection: {
        url: "http://old-seerr.test",
        apiUrl: "http://old-seerr.test/api/v1",
        authMethod: "jellyfin",
        jellyfinServerUrl: "http://old-jellyfin.test",
        jellyfinUserId: "old-user",
        jellyfinAccessToken: "old-test-token",
        userId: 99,
      },
    });
    await render();
    await connect();
    await fill("Username", "Library user");
    await fill("Password", "jellyfin-password");
    await click("Sign in");
    expect(loginJellyfin).toHaveBeenCalledWith(
      "Library user",
      "jellyfin-password",
      false,
    );
    expectPendingChoice();

    await click("Skip for now");
    expect(useJellyfinAuth.getState().session).toEqual(session);
    expect(useSeerrConnection.getState().connection).toBeNull();
    expect(container.querySelector("[data-location]")?.textContent).toBe("/");
    expect(authenticateSeerr).not.toHaveBeenCalled();
    expect(getSeerrUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires the same choice for a passwordless public Jellyfin account", async () => {
    vi.mocked(getServerLogin).mockResolvedValue({
      users: [{ Id: "guest", Name: "Guest", HasPassword: false }],
    });
    await render("/");
    await connect();
    await click("Guest");
    expect(loginJellyfin).toHaveBeenCalledWith("Guest", "", false);
    expectPendingChoice();
    await click("Skip for now");
    expect(useJellyfinAuth.getState().session).toEqual(session);
    expect(container.querySelector("[data-location]")?.textContent).toBe("/");
  });

  it("publishes the pending Jellyfin session after explicit Seerr setup completes", async () => {
    await render();
    await connect();
    await fill("Username", "Library user");
    await fill("Password", "jellyfin-password");
    await click("Sign in");
    expectPendingChoice();
    await click("Enable Seerr");
    await fill("Password", "explicit-seerr-password");
    await click("Connect Seerr");
    expect(useJellyfinAuth.getState().session).toEqual(session);
    expect(container.querySelector("[data-location]")?.textContent).toBe(
      "/discover",
    );
  });

  it("keeps Jellyfin unpublished after Seerr verification fails and allows skipping into the library", async () => {
    vi.mocked(getSeerrUser).mockRejectedValueOnce(
      new Error("Seerr could not verify the signed-in user."),
    );
    await render("/discover");
    await connect();
    await fill("Username", "Library user");
    await fill("Password", "jellyfin-password");
    await click("Sign in");
    await click("Enable Seerr");
    await fill("Password", "explicit-seerr-password");
    await click("Connect Seerr");
    expect(authenticateSeerr).toHaveBeenCalledOnce();
    expect(getSeerrUser).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Seerr could not verify the signed-in user.",
    );
    expect(useJellyfinAuth.getState().session).toBeNull();
    expect(useSeerrConnection.getState().connection).toBeNull();
    expect(container.querySelector("[data-location]")?.textContent).toBe(
      "/login",
    );
    await click("Skip for now");
    expect(useJellyfinAuth.getState().session).toEqual(session);
    expect(useSeerrConnection.getState().connection).toBeNull();
    expect(container.querySelector("[data-location]")?.textContent).toBe("/");
  });
});
