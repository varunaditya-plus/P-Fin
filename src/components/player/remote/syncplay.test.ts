// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getJellyfinSession, jellyfinRequest } from "@/backend/jellyfin/client";

import {
  JellyfinSyncPlay,
  SyncPlayCommand,
  clockMeasurement,
  syncPlaySocketUrl,
  useSyncPlayState,
} from "./syncplay";

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: vi.fn(),
  jellyfinRequest: vi.fn(),
  jellyfinUrl: (path: string, query: Record<string, string>) =>
    `http://localhost/jellyfin/${path}?${new URLSearchParams(query)}`,
}));
const owner = {
  serverUrl: "/jellyfin",
  userId: "user",
  userName: "User",
  deviceId: "browser",
  accessToken: "test-token",
};
const now = Date.parse("2026-09-27T12:00:00Z");
const date = (offset = 0) => new Date(now + offset).toISOString();
const group = {
  GroupId: "group",
  GroupName: "Friends",
  State: "Paused",
  Participants: ["User"],
  LastUpdatedAt: date(),
};
// eslint-disable-next-line no-use-before-define
let socket: MockSocket;
class MockSocket {
  static OPEN = 1;

  readyState = 1;

  onopen?: () => void;

  onclose?: () => void;

  onerror?: () => void;

  onmessage?: (event: { data: string }) => void;

  send = vi.fn();

  close = vi.fn();

  url: string;

  constructor(url: string) {
    this.url = url;
    socket = this;
    Promise.resolve().then(() => this.onopen?.());
  }
}
let snapshot: {
  itemId: string;
  seconds: number;
  playing: boolean;
  ready: boolean;
  rate: number;
};
const player = {
  snapshot: () => snapshot,
  pause: vi.fn(() => {
    snapshot.playing = false;
  }),
  play: vi.fn(() => {
    snapshot.playing = true;
  }),
  seek: vi.fn((seconds: number) => {
    snapshot.seconds = seconds;
  }),
  rate: vi.fn((rate: number) => {
    snapshot.rate = rate;
  }),
  load: vi.fn(),
};
let controller: JellyfinSyncPlay;
const request = vi.mocked(jellyfinRequest);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  vi.mocked(getJellyfinSession).mockReturnValue(owner);
  request.mockImplementation(async (path) => {
    if (path.startsWith("Users/"))
      return { Policy: { SyncPlayAccess: "CreateAndJoinGroups" } } as any;
    if (path === "GetUtcTime")
      return {
        RequestReceptionTime: date(),
        ResponseTransmissionTime: date(),
      } as any;
    if (path === "SyncPlay/New") return group as any;
    return undefined;
  });
  vi.stubGlobal("WebSocket", MockSocket);
  snapshot = {
    itemId: "item",
    seconds: 12,
    playing: false,
    ready: true,
    rate: 1.25,
  };
  controller = new JellyfinSyncPlay(player);
});
afterEach(() => {
  controller.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function initialize() {
  await controller.initialize();
}
function receive(type: string, data: unknown, id = "group") {
  controller.receive({
    MessageType: "SyncPlayGroupUpdate",
    Data: { Type: type, GroupId: id, Data: data },
  });
}
function joined() {
  receive("GroupJoined", group);
  receive("PlayQueue", {
    Reason: "NewPlaylist",
    LastUpdate: date(),
    Playlist: [{ ItemId: "item", PlaylistItemId: "playlist-item" }],
    PlayingItemIndex: 0,
    StartPositionTicks: 120000000,
    IsPlaying: false,
  });
}
function command(
  kind: SyncPlayCommand["Command"],
  overrides: Partial<SyncPlayCommand> = {},
) {
  controller.receive({
    MessageType: "SyncPlayCommand",
    Data: {
      GroupId: "group",
      PlaylistItemId: "playlist-item",
      Command: kind,
      When: date(),
      EmittedAt: date(),
      PositionTicks: 120000000,
      ...overrides,
    },
  });
}
const callsFor = (path: string) =>
  request.mock.calls
    .filter(([called]) => called === `SyncPlay/${path}`)
    .map(([, init]) =>
      init?.body ? JSON.parse(String(init.body)) : undefined,
    );

describe("Jellyfin SyncPlay protocol", () => {
  it("measures the server clock and uses the authenticated device-specific WebSocket", () => {
    expect(
      clockMeasurement(
        1000,
        1120,
        new Date(2060).toISOString(),
        new Date(2080).toISOString(),
      ),
    ).toEqual({ offset: 1010, delay: 100, ping: 50 });
    const url = new URL(syncPlaySocketUrl());
    expect(url.protocol).toBe("ws:");
    expect(url.pathname).toBe("/jellyfin/socket");
    expect(url.searchParams.get("deviceId")).toBe("browser");
    expect(url.searchParams.get("ApiKey")).toBe(owner.accessToken);
    expect(url.searchParams.has("token")).toBe(false);
  });
  it("enforces account permissions before creating or opening a socket", async () => {
    request.mockResolvedValue({ Policy: { SyncPlayAccess: "None" } });
    await expect(controller.initialize()).rejects.toThrow("disabled");
    expect(useSyncPlayState.getState().access).toBe("None");
    request.mockImplementation(async (path) =>
      path.startsWith("Users/")
        ? ({ Policy: { SyncPlayAccess: "JoinGroups" } } as any)
        : ({
            RequestReceptionTime: date(),
            ResponseTransmissionTime: date(),
          } as any),
    );
    await initialize();
    await expect(controller.create("Friends", ["item"], 0)).rejects.toThrow(
      "cannot create",
    );
    expect(callsFor("New")).toHaveLength(0);
  });
  it("sends keep-alives at half the server timeout and cleans them up", async () => {
    await initialize();
    controller.receive({ MessageType: "ForceKeepAlive", Data: 20 });
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ MessageType: "KeepAlive" }),
    );
    await vi.advanceTimersByTimeAsync(10000);
    expect(socket.send).toHaveBeenCalledTimes(2);
    controller.dispose();
    await vi.advanceTimersByTimeAsync(20000);
    expect(socket.send).toHaveBeenCalledTimes(2);
  });
  it("creates a group and shares the queue with a resume position", async () => {
    await initialize();
    await controller.create(" Friends ", ["item", "next"], 420000000);
    expect(callsFor("New")).toEqual([{ GroupName: "Friends" }]);
    expect(callsFor("SetNewQueue")).toEqual([
      {
        PlayingQueue: ["item", "next"],
        PlayingItemPosition: 0,
        StartPositionTicks: 420000000,
      },
    ]);
    expect(useSyncPlayState.getState().group?.GroupId).toBe("group");
    expect(snapshot.rate).toBe(1);
  });
  it("waits for matching membership confirmation and shows library permission failures", async () => {
    await initialize();
    const joining = controller.join("group");
    await vi.waitFor(() => expect(callsFor("Join")).toHaveLength(1));
    receive("GroupJoined", { ...group, GroupId: "other" }, "other");
    expect(useSyncPlayState.getState().group).toBeNull();
    receive("GroupJoined", group);
    await joining;
    expect(useSyncPlayState.getState().group?.GroupId).toBe("group");
    await controller.leave();
    const denied = controller.join("group");
    const assertion = expect(denied).rejects.toThrow("cannot access");
    await vi.waitFor(() => expect(callsFor("Join")).toHaveLength(2));
    receive("LibraryAccessDenied", null);
    await assertion;
  });
  it("schedules server commands, ignores stale or unrelated commands, and compensates late resume", async () => {
    await initialize();
    joined();
    controller.tick();
    command("Unpause", { When: date(1000) });
    expect(player.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(player.play).toHaveBeenCalledOnce();
    command("Pause", { GroupId: "unrelated", EmittedAt: date(1000) });
    expect(snapshot.playing).toBe(true);
    command("Pause", { PlaylistItemId: "wrong", EmittedAt: date(1000) });
    expect(snapshot.playing).toBe(true);
    command("Pause", { EmittedAt: date(-1) });
    expect(snapshot.playing).toBe(true);
    command("Unpause", {
      When: date(-1000),
      EmittedAt: date(1000),
      PositionTicks: 500000000,
    });
    expect(snapshot.seconds).toBe(52);
  });
  it("reports readiness once, waits through seeking, and reports sustained buffering", async () => {
    await initialize();
    joined();
    controller.tick();
    controller.tick();
    expect(callsFor("Ready")).toHaveLength(1);
    command("Seek", { PositionTicks: 450000000 });
    snapshot.ready = false;
    controller.tick();
    expect(snapshot.seconds).toBe(45);
    expect(snapshot.playing).toBe(false);
    snapshot.ready = true;
    controller.tick();
    controller.tick();
    expect(callsFor("Ready")).toHaveLength(2);
    expect(callsFor("Ready").at(-1)).toMatchObject({
      PositionTicks: 450000000,
      IsPlaying: false,
      PlaylistItemId: "playlist-item",
    });
    snapshot.ready = false;
    controller.tick();
    await vi.advanceTimersByTimeAsync(3000);
    controller.tick();
    controller.tick();
    expect(callsFor("Buffering")).toHaveLength(1);
  });
  it("follows queue changes across episodes, queues commands until media is ready, and preserves membership", async () => {
    await initialize();
    joined();
    receive("PlayQueue", {
      Reason: "NextItem",
      LastUpdate: date(100),
      Playlist: [{ ItemId: "next", PlaylistItemId: "next-playlist" }],
      PlayingItemIndex: 0,
      StartPositionTicks: 0,
      IsPlaying: false,
    });
    expect(player.load).toHaveBeenCalledWith("next", 0);
    command("Unpause", {
      PlaylistItemId: "next-playlist",
      EmittedAt: date(100),
    });
    expect(player.play).not.toHaveBeenCalled();
    snapshot.itemId = "next";
    snapshot.seconds = 0;
    snapshot.ready = true;
    controller.tick();
    expect(player.play).toHaveBeenCalledOnce();
    expect(useSyncPlayState.getState().group?.GroupId).toBe("group");
    controller.action("NextItem");
    expect(callsFor("NextItem")).toEqual([{ PlaylistItemId: "next-playlist" }]);
  });
  it("routes user commands and restores the saved speed on leave", async () => {
    await initialize();
    joined();
    controller.action("Seek", 25);
    controller.action("Pause");
    controller.action("Unpause");
    expect(callsFor("Seek")).toEqual([{ PositionTicks: 250000000 }]);
    expect(callsFor("Pause")).toHaveLength(1);
    expect(callsFor("Unpause")).toHaveLength(1);
    await controller.leave();
    expect(snapshot.rate).toBe(1.25);
    expect(useSyncPlayState.getState().group).toBeNull();
  });
  it("cancels timed commands and pauses locally if the group connection is lost", async () => {
    await initialize();
    joined();
    command("Unpause", { When: date(1000) });
    socket.onclose?.();
    await vi.advanceTimersByTimeAsync(2000);
    expect(player.play).not.toHaveBeenCalled();
    expect(useSyncPlayState.getState().group).toBeNull();
    expect(useSyncPlayState.getState().error).toContain("disconnected");
  });
});

it("retries a failed Ready report with backoff rather than leaving the group waiting", async () => {
  await initialize();
  joined();
  request.mockRejectedValueOnce(new Error("Temporary network failure"));
  controller.tick();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(callsFor("Ready")).toHaveLength(1);
  controller.tick();
  expect(callsFor("Ready")).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(2000);
  controller.tick();
  await Promise.resolve();
  await Promise.resolve();
  expect(callsFor("Ready")).toHaveLength(2);
  expect(player.play).not.toHaveBeenCalled();
});
it("does not retry a failed Ready report after leaving its group", async () => {
  await initialize();
  joined();
  let fail: (error: Error) => void = () => {};
  request.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  controller.tick();
  await controller.leave();
  fail(new Error("Old request failed"));
  await vi.advanceTimersByTimeAsync(2000);
  controller.tick();
  expect(callsFor("Ready")).toHaveLength(1);
  expect(useSyncPlayState.getState().error).toBe("");
});
