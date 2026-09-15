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
  ChromecastSettingsView,
  JellyfinChromecastProvider,
} from "./JellyfinChromecast";

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

    disconnect = async () => {
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
