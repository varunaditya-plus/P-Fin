// @vitest-environment jsdom
import { ReactNode, act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChromecastState } from "@/components/player/remote/chromecast";

import { JellyfinSettingsRouter } from "./JellyfinControls";

const router = vi.hoisted(() => ({
  route: "/",
  navigate: vi.fn(),
  close: vi.fn(),
}));
const changeSubtitle = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useOverlayRouter", () => ({
  useOverlayRouter: () => router,
}));
vi.mock("@/components/overlays/OverlayDisplay", () => ({
  Overlay: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/overlays/OverlayRouter", () => ({
  OverlayRouter: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/overlays/OverlayPage", () => ({
  OverlayPage: ({ children, path }: { children: ReactNode; path: string }) =>
    path === router.route ? children : null,
}));
vi.mock("@/pages/jellyfin/JellyfinDetailsModal", () => ({
  JellyfinDetailsModal: () => null,
}));
vi.mock("./JellyfinPlaybackContext", () => ({
  useJellyfinPlayback: () => ({
    playback: {
      audioIndex: 0,
      mediaSource: {
        Id: "source",
        MediaStreams: [
          { Index: 0, Type: "Audio", DisplayTitle: "English audio" },
          { Index: 1, Type: "Subtitle", DisplayTitle: "English subtitles" },
          { Index: 2, Type: "Subtitle", DisplayTitle: "Spanish subtitles" },
        ],
      },
    },
    mediaSources: [],
    subtitleIndex: 1,
    maxBitrate: 120_000_000,
    changeSubtitle,
    changeAudio: vi.fn(),
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let controllers: (Pick<Gamepad, "id" | "connected"> | null)[];
const getGamepads = vi.fn(() => controllers);

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  controllers = [];
  getGamepads.mockImplementation(() => controllers);
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: getGamepads,
  });
  router.route = "/";
  useChromecastState.setState({
    available: false,
    connected: false,
    casting: false,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function render(path = "/") {
  router.route = path;
  act(() => root.render(<JellyfinSettingsRouter />));
}
function button(text: string) {
  return [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === text,
  );
}

describe("player device menu visibility", () => {
  it("hides unavailable device actions and the duplicate subtitle appearance shortcut", () => {
    render();
    expect(button("Google Cast")).toBeUndefined();
    expect(button("Controller")).toBeUndefined();
    expect(button("Subtitle appearance")).toBeUndefined();
  });

  it("updates controller visibility on connection and disconnection", () => {
    controllers = [null, { id: "Old controller", connected: false }];
    render();
    expect(button("Controller")).toBeUndefined();
    controllers = [null, { id: "Xbox controller", connected: true }];
    act(() => window.dispatchEvent(new Event("gamepadconnected")));
    expect(button("Controller")).toBeTruthy();
    act(() => button("Controller")!.click());
    expect(router.navigate).toHaveBeenCalledWith("/controller");
    controllers = [];
    act(() => window.dispatchEvent(new Event("gamepaddisconnected")));
    expect(button("Controller")).toBeUndefined();
  });

  it("hides controller settings if browser policy blocks reading devices", () => {
    getGamepads.mockImplementation(() => {
      throw new DOMException("Not allowed", "SecurityError");
    });
    render();
    expect(button("Controller")).toBeUndefined();
    expect(button("SyncPlay")).toBeTruthy();
  });

  it("hides controller settings when the Gamepad API is unsupported", () => {
    Object.defineProperty(navigator, "getGamepads", { value: undefined });
    render();
    expect(button("Controller")).toBeUndefined();
  });

  it("shows Cast for an available or connected receiver and retains active cast controls", () => {
    render();
    act(() => useChromecastState.setState({ available: true }));
    expect(button("Google Cast")).toBeTruthy();
    act(() => button("Google Cast")!.click());
    expect(router.navigate).toHaveBeenCalledWith("/cast");
    act(() =>
      useChromecastState.setState({ available: false, connected: true }),
    );
    expect(button("Google Cast")).toBeTruthy();
    act(() => useChromecastState.setState({ casting: true }));
    expect(button("Google Cast controls")).toBeTruthy();
    act(() => button("Google Cast controls")!.click());
    expect(router.navigate).toHaveBeenLastCalledWith("/cast");
    act(() =>
      useChromecastState.setState({ connected: false, casting: false }),
    );
    expect(button("Google Cast")).toBeUndefined();
  });
});

describe("subtitle track menu", () => {
  it("keeps Off and all subtitle tracks ahead of the advanced tools and preserves Customize", () => {
    render("/captions");
    const labels = [...container.querySelectorAll("button")].map((element) =>
      element.textContent?.trim(),
    );
    expect(labels.slice(-6)).toEqual([
      "Off",
      "English subtitles",
      "Spanish subtitles",
      "Transcript",
      "Translate subtitles",
      "Synchronise subtitles",
    ]);
    act(() => button("Customize")!.click());
    expect(router.navigate).toHaveBeenCalledWith("/captions/settings");
    act(() => button("Spanish subtitles")!.click());
    expect(changeSubtitle).toHaveBeenCalledWith(2);
    expect(router.close).toHaveBeenCalledOnce();
  });

  it("keeps subtitle tools out of the audio track menu", () => {
    render("/audio");
    expect(button("English audio")).toBeTruthy();
    expect(button("Transcript")).toBeUndefined();
    expect(button("Customize")).toBeUndefined();
  });
});
