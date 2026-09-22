// @vitest-environment jsdom
/* eslint-disable class-methods-use-this */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useJellyfinAuth } from "@/stores/jellyfin";

import {
  JellyfinSyncPlayProvider,
  SyncPlaySettingsView,
} from "./JellyfinSyncPlay";
import { SyncPlayGroup, useSyncPlayState } from "./syncplay";

const list = vi.hoisted(() => vi.fn());
const join = vi.hoisted(() => vi.fn());
vi.mock("@/components/player/jellyfin/JellyfinPlaybackContext", () => ({
  useJellyfinPlayback: () => ({
    itemId: "item",
    episodes: [],
    playback: { itemId: "item" },
  }),
}));
vi.mock("./syncplay", async (original) => ({
  ...(await original<typeof import("./syncplay")>()),
  JellyfinSyncPlay: class {
    list = list;

    join = join;

    tick = () => {};

    dispose = () => {};
  },
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  useSyncPlayState.setState({
    connected: false,
    access: "JoinGroups",
    group: null,
    queue: null,
    error: "",
    ping: 0,
  });
  useJellyfinAuth.setState({
    session: {
      userId: "user",
      userName: "Test",
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
  vi.unstubAllGlobals();
});
async function render(blocked = false) {
  await act(async () =>
    root.render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <JellyfinSyncPlayProvider onPlayItem={() => {}} blocked={blocked}>
          <SyncPlaySettingsView />
        </JellyfinSyncPlayProvider>
      </MemoryRouter>,
    ),
  );
}
it("shows list loading and the resolved empty state even before the socket is connected", async () => {
  let complete!: (groups: SyncPlayGroup[]) => void;
  list.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  await render();
  expect(container.textContent).toContain("Finding groups…");
  expect(container.textContent).not.toContain("No groups are active.");
  await act(async () => complete([]));
  expect(container.textContent).toContain("No groups are active.");
  expect(container.textContent).not.toContain("Finding groups…");
});
it("keeps joining disabled while casting and lists each active participant", async () => {
  const group = {
    GroupId: "group",
    GroupName: "Movie night",
    Participants: ["Alice", "Bob"],
    State: "Paused",
    LastUpdatedAt: "",
  };
  list.mockResolvedValue([group]);
  await render(true);
  const button = [...container.querySelectorAll("button")].find((entry) =>
    entry.textContent?.includes("Movie night"),
  );
  expect(button?.disabled).toBe(true);
  await act(async () => button!.click());
  expect(join).not.toHaveBeenCalled();
  await act(async () =>
    useSyncPlayState.setState({ group, connected: true, ping: 14 }),
  );
  expect(
    [...container.querySelectorAll("li")].map((entry) => entry.textContent),
  ).toEqual(["Alice", "Bob"]);
  expect(container.textContent).toContain("Watching together (2)");
  expect(container.textContent).toContain("14 ms");
});
