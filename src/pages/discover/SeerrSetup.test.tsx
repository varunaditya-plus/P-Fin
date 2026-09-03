import { act } from "react";
import { Root, createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticateSeerr, getSeerrUser } from "@/backend/seerr/api";
import { getConfiguredSeerrServer } from "@/backend/seerr/servers";
import { SeerrUser } from "@/backend/seerr/types";
import { JellyfinSession } from "@/stores/jellyfin";
import { useSeerrConnection } from "@/stores/seerr";

import { SeerrSetup } from "./SeerrSetup";

vi.mock("@/backend/seerr/api", () => ({
  authenticateSeerr: vi.fn(),
  getSeerrUser: vi.fn(),
}));
vi.mock("@/backend/seerr/servers", async (original) => ({
  ...(await original<typeof import("@/backend/seerr/servers")>()),
  getConfiguredSeerrServer: vi.fn(),
}));

const session: JellyfinSession = {
  serverUrl: "/jellyfin",
  userId: "jellyfin-user",
  userName: "Library user",
  accessToken: "test-token",
  deviceId: "test-device",
};
const user: SeerrUser = { id: 21, username: "Seerr user", permissions: 2 };
const configuredUrl = "http://requests.test:5055";
const onComplete = vi.fn();
const onSkip = vi.fn();
let root: Root;
let container: HTMLDivElement;

async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SeerrSetup session={session} onComplete={onComplete} onSkip={onSkip} />
      </MemoryRouter>,
    ),
  );
}

function inputFor(label: string) {
  const labelElement = [...container.querySelectorAll("label")].find(
    (element) => element.textContent?.trim() === label,
  );
  const input = document.getElementById(
    labelElement?.htmlFor ?? "",
  ) as HTMLInputElement | null;
  expect(input, `Missing input ${label}`).not.toBeNull();
  return input!;
}

async function fill(label: string, value: string) {
  const input = inputFor(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function buttonFor(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === text,
  );
  expect(button, `Missing button ${text}`).toBeDefined();
  return button!;
}

async function click(text: string) {
  await act(async () => buttonFor(text).click());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn());
  useSeerrConnection.setState({ connection: null });
  vi.mocked(getConfiguredSeerrServer).mockResolvedValue(configuredUrl);
  vi.mocked(authenticateSeerr).mockResolvedValue(user);
  vi.mocked(getSeerrUser).mockResolvedValue(user);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useSeerrConnection.setState({ connection: null });
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("optional Seerr setup", () => {
  it("waits for an explicit choice and skips without contacting Seerr", async () => {
    await render();
    expect(container.textContent).toContain("Enable Seerr?");
    expect(container.querySelector("form")).toBeNull();
    expect(authenticateSeerr).not.toHaveBeenCalled();
    expect(getSeerrUser).not.toHaveBeenCalled();
    await click("Skip for now");
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expect(authenticateSeerr).not.toHaveBeenCalled();
    expect(getSeerrUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(useSeerrConnection.getState().connection).toBeNull();
  });

  it("requires entered credentials and a verified user before saving the connection", async () => {
    let verifyUser: ((value: SeerrUser) => void) | undefined;
    vi.mocked(getSeerrUser).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          verifyUser = resolve;
        }),
    );
    await render();
    await click("Enable Seerr");
    expect(inputFor("Username").value).toBe(session.userName);
    expect(inputFor("Password").value).toBe("");
    expect(authenticateSeerr).not.toHaveBeenCalled();
    await fill("Password", "entered-seerr-password");
    await click("Connect Seerr");
    const connection = {
      url: configuredUrl,
      apiUrl: "/seerr/api/v1",
      authMethod: "jellyfin",
      jellyfinServerUrl: session.serverUrl,
      jellyfinUserId: session.userId,
      jellyfinAccessToken: session.accessToken,
    };
    expect(authenticateSeerr).toHaveBeenCalledWith(
      session.userName,
      "entered-seerr-password",
      connection,
    );
    expect(getSeerrUser).toHaveBeenCalledWith(connection);
    expect(useSeerrConnection.getState().connection).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    expect(buttonFor("Skip for now").disabled).toBe(true);
    await act(async () => verifyUser?.(user));
    expect(useSeerrConnection.getState().connection).toEqual({
      ...connection,
      userId: user.id,
    });
    expect(onComplete).toHaveBeenCalledWith(user);
    expect(inputFor("Password").value).toBe("");
  });

  it("uses a newly entered server and local email authentication", async () => {
    await render();
    await click("Enable Seerr");
    const select = container.querySelector("select")!;
    await act(async () => {
      select.value = "local";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(inputFor("Email").value).toBe("");
    await fill("Seerr server address", "https://new-seerr.test/requests/");
    await fill("Email", "person@example.test");
    await fill("Password", "local-seerr-password");
    await click("Connect Seerr");
    expect(authenticateSeerr).toHaveBeenCalledWith(
      "person@example.test",
      "local-seerr-password",
      expect.objectContaining({
        url: "https://new-seerr.test/requests",
        apiUrl: "https://new-seerr.test/requests/api/v1",
        authMethod: "local",
      }),
    );
    expect(useSeerrConnection.getState().connection).toMatchObject({
      url: "https://new-seerr.test/requests",
      authMethod: "local",
      userId: user.id,
    });
    expect(onComplete).toHaveBeenCalledWith(user);
  });

  it("keeps a failed sign-in recoverable through Back and Skip", async () => {
    vi.mocked(authenticateSeerr).mockRejectedValueOnce(
      new Error("The Seerr credentials were rejected."),
    );
    await render();
    await click("Enable Seerr");
    await fill("Password", "wrong-password");
    await click("Connect Seerr");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "The Seerr credentials were rejected.",
    );
    expect(getSeerrUser).not.toHaveBeenCalled();
    expect(useSeerrConnection.getState().connection).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    expect(buttonFor("Back").disabled).toBe(false);
    await click("Back");
    expect(container.textContent).toContain("Enable Seerr?");
    await click("Enable Seerr");
    expect(inputFor("Password").value).toBe("");
    await click("Skip for now");
    expect(onSkip).toHaveBeenCalledOnce();
    expect(authenticateSeerr).toHaveBeenCalledOnce();
  });

  it("does not save an authenticated connection when user verification fails", async () => {
    vi.mocked(getSeerrUser).mockRejectedValueOnce(
      new Error("The Seerr session could not be verified."),
    );
    await render();
    await click("Enable Seerr");
    await fill("Password", "entered-password");
    await click("Connect Seerr");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "The Seerr session could not be verified.",
    );
    expect(useSeerrConnection.getState().connection).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    await click("Skip for now");
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
