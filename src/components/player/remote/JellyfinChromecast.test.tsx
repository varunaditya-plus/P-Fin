// @vitest-environment jsdom
/* eslint-disable class-methods-use-this */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useJellyfinAuth } from "@/stores/jellyfin";

import { useChromecastState } from "./chromecast";
import {
  CastReceiverStatus,
  ChromecastSettingsView,
  JellyfinChromecastButton,
  JellyfinChromecastProvider,
} from "./JellyfinChromecast";

const disconnected = vi.hoisted(() => vi.fn());

vi.mock("@/components/player/jellyfin/JellyfinPlaybackContext", () => ({
  useJellyfinPlayback: () => ({
    playback: { itemId: "local-A", mediaSource: { Id: "source" } },
    subtitleIndex: -1,
    maxBitrate: 20000000,
  }),
}));
vi.mock("./chromecast", async (original) => ({
  ...(await original<typeof import("./chromecast")>()),
  JellyfinChromecast: class {
    initialize = async () => {};

    disconnect = async (stop: boolean) => {
      disconnected(stop);
      useChromecastState.setState({
        casting: false,
        connected: false,
        state: null,
      });
    };

    dispose = () => {};
  },
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const returned = vi.fn().mockResolvedValue(undefined);
const started = vi.fn();
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  useChromecastState.setState({
    initialized: true,
    connected: false,
    casting: false,
    available: false,
    state: null,
    error: "",
  });
  useJellyfinAuth.setState({
    session: {
      userId: "user",
      userName: "User",
      serverUrl: "/jellyfin",
      accessToken: "test-token",
      deviceId: "device",
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useJellyfinAuth.setState({ session: null });
});
async function start() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <JellyfinChromecastProvider
          onCastStarted={started}
          onReturnToLocal={returned}
        >
          <ChromecastSettingsView />
        </JellyfinChromecastProvider>
      </MemoryRouter>,
    ),
  );
  await act(async () =>
    useChromecastState.setState({
      casting: true,
      connected: true,
      state: { ItemId: "remote-B", PlayState: { PositionTicks: 300000000 } },
    }),
  );
  expect(started).toHaveBeenCalledOnce();
}
it("returns the receiver's item on explicit handoff exactly once even when loading resolves immediately", async () => {
  await start();
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === "Play on this device",
  );
  expect(button).toBeTruthy();
  await act(async () => (button as HTMLElement).click());
  expect(returned).toHaveBeenCalledOnce();
  expect(returned).toHaveBeenCalledWith(300000000, true, "remote-B");
});
it("retains receiver item and time when a disconnect clears the active receiver state", async () => {
  await start();
  await act(async () =>
    useChromecastState.setState({
      casting: false,
      connected: false,
      state: null,
    }),
  );
  expect(returned).toHaveBeenCalledOnce();
  expect(returned).toHaveBeenCalledWith(300000000, false, "remote-B");
});

it("disconnects an idle receiver after a failed start without stopping its media or restarting local playback", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <JellyfinChromecastProvider
          onCastStarted={started}
          onReturnToLocal={returned}
        >
          <ChromecastSettingsView />
        </JellyfinChromecastProvider>
      </MemoryRouter>,
    ),
  );
  await act(async () =>
    useChromecastState.setState({
      connected: true,
      casting: false,
      error: "Receiver could not start this title.",
    }),
  );
  const disconnect = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Disconnect receiver",
  );
  expect(disconnect).toBeTruthy();
  await act(async () => disconnect!.click());
  expect(disconnected).toHaveBeenCalledWith(false);
  expect(useChromecastState.getState().connected).toBe(false);
  expect(returned).not.toHaveBeenCalled();
  expect(started).not.toHaveBeenCalled();
  expect(
    [...container.querySelectorAll("button")].some(
      (button) => button.textContent?.trim() === "Disconnect receiver",
    ),
  ).toBe(false);
});

it("only exposes the toolbar cast action for an available receiver and identifies paused receiver playback", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <JellyfinChromecastProvider
          onCastStarted={started}
          onReturnToLocal={returned}
        >
          <JellyfinChromecastButton />
          <CastReceiverStatus />
        </JellyfinChromecastProvider>
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector('[aria-label="Cast to a device"]')).toBeNull();
  await act(async () => useChromecastState.setState({ available: true }));
  expect(
    container.querySelector('[aria-label="Cast to a device"]'),
  ).not.toBeNull();
  await act(async () =>
    useChromecastState.setState({
      casting: true,
      connected: true,
      receiver: "Living room",
      state: {
        NowPlayingItem: { Id: "remote-B", Name: "Episode two" },
        PlayState: { IsPaused: true },
      },
    }),
  );
  expect(
    container.querySelector('[aria-label="Casting to Living room"]'),
  ).not.toBeNull();
  expect(container.textContent).toContain("Episode two");
  expect(container.textContent).toContain("Paused");
});
