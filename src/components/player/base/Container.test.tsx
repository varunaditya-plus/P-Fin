// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, it, vi } from "vitest";

import { Container } from "./Container";

vi.mock("@/components/overlays/OverlayDisplay", () => ({
  OverlayDisplay: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/player/internals/HeadUpdater", () => ({
  HeadUpdater: () => null,
}));
vi.mock("@/components/player/internals/KeyboardEvents", () => ({
  KeyboardEvents: () => <span data-local="keyboard" />,
}));
vi.mock("@/components/player/internals/MediaSession", () => ({
  MediaSession: () => <span data-local="media-session" />,
}));
vi.mock("@/components/player/internals/VideoClickTarget", () => ({
  VideoClickTarget: () => <span data-local="pointer" />,
}));
vi.mock("@/components/player/internals/VideoContainer", () => ({
  VideoContainer: ({ suspended }: { suspended: boolean }) =>
    suspended ? null : <video />,
}));
it("unmounts keyboard, OS media, pointer and video owners for cast playback, then restores them", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <Container showingControls>
          <button type="button">Cast controls</button>
        </Container>,
      ),
    );
    expect(container.querySelectorAll("[data-local]")).toHaveLength(3);
    await act(async () =>
      root.render(
        <Container showingControls localPlaybackSuspended>
          <button type="button">Cast controls</button>
        </Container>,
      ),
    );
    expect(container.querySelectorAll("[data-local]")).toHaveLength(0);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("button")?.textContent).toBe(
      "Cast controls",
    );
    await act(async () => root.render(<Container showingControls />));
    expect(container.querySelectorAll("[data-local]")).toHaveLength(3);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
