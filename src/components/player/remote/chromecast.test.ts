/* eslint-disable max-classes-per-file */
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getJellyfinSession, jellyfinRequest } from "@/backend/jellyfin/client";

import {
  CAST_NAMESPACE,
  CastApi,
  CastSession,
  JellyfinChromecast,
  castServerAddress,
  useChromecastState,
} from "./chromecast";

vi.mock("@/backend/jellyfin/client", () => ({
  getJellyfinSession: vi.fn(),
  jellyfinRequest: vi.fn(),
}));
const owner = {
  serverUrl: "/jellyfin",
  serverAddress: "http://media.local:8096",
  userId: "user",
  userName: "User",
  deviceId: "browser",
  accessToken: "test-token",
};
let receive: (namespace: string, message: unknown) => void;
let controller: JellyfinChromecast;
let session: CastSession;
const messages: {
  command: string;
  options: Record<string, unknown>;
  serverAddress: string;
  maxBitrate?: number;
}[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getJellyfinSession).mockReturnValue(owner);
  vi.mocked(jellyfinRequest).mockImplementation(async (path) =>
    path.startsWith("Users/")
      ? { Configuration: { CastReceiverId: "receiver-id" } }
      : ({ Id: "server", Version: "12.1" } as any),
  );
  messages.length = 0;
  session = {
    receiver: { friendlyName: "Living room" },
    addMessageListener: vi.fn((_namespace, listener) => {
      receive = listener;
    }),
    removeMessageListener: vi.fn(),
    addUpdateListener: vi.fn(),
    removeUpdateListener: vi.fn(),
    sendMessage: vi.fn((_namespace, message, success) => {
      messages.push(JSON.parse(message));
      success();
    }),
    setReceiverVolumeLevel: vi.fn((_level, success) => success()),
    stop: vi.fn((success) => success()),
    leave: vi.fn((success) => success()),
  };
  class SessionRequest {
    id: string;

    constructor(id: string) {
      this.id = id;
    }
  }
  class ApiConfig {
    request: unknown;

    sessionListener: unknown;

    receiverListener: unknown;

    constructor(
      request: unknown,
      sessionListener: unknown,
      receiverListener: unknown,
    ) {
      this.request = request;
      this.sessionListener = sessionListener;
      this.receiverListener = receiverListener;
    }
  }
  const api: CastApi = {
    isAvailable: true,
    SessionRequest,
    ApiConfig,
    initialize: vi.fn((_config, success) => success()),
    requestSession: vi.fn((success) => success(session)),
  };
  vi.stubGlobal("chrome", { cast: api });
  controller = new JellyfinChromecast();
});
afterEach(() => {
  controller.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Jellyfin cast protocol", () => {
  it("uses the real server address and waits for matching receiver playback acknowledgement", async () => {
    await controller.initialize();
    await controller.connect();
    const completed = vi.fn();
    const playing = controller
      .play({
        item: { Id: "item", Name: "Film", Type: "Movie" },
        positionTicks: 123000000,
        mediaSourceId: "version",
        audioIndex: 2,
        subtitleIndex: -1,
        maxBitrate: 20000000,
      })
      .then(completed);
    expect(useChromecastState.getState().casting).toBe(false);
    expect(messages.at(-1)).toMatchObject({
      command: "PlayNow",
      serverAddress: owner.serverAddress,
      maxBitrate: 20000000,
      options: {
        startPositionTicks: 123000000,
        mediaSourceId: "version",
        audioStreamIndex: 2,
        subtitleStreamIndex: -1,
      },
    });
    receive(
      CAST_NAMESPACE,
      JSON.stringify({ type: "playbackstart", data: { ItemId: "different" } }),
    );
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    receive(
      CAST_NAMESPACE,
      JSON.stringify({
        type: "playbackstart",
        data: { ItemId: "item", PlayState: { PositionTicks: 123000000 } },
      }),
    );
    await playing;
    expect(completed).toHaveBeenCalledOnce();
    expect(useChromecastState.getState().casting).toBe(true);
  });
  it("fails explicitly if the receiver cannot start playback, without claiming an active cast", async () => {
    await controller.initialize();
    await controller.connect();
    const result = controller.play({
      item: { Id: "item", Name: "Film", Type: "Movie" },
      positionTicks: 0,
    });
    const assertion = expect(result).rejects.toThrow("could not play");
    receive(
      CAST_NAMESPACE,
      JSON.stringify({ type: "connectionerror", data: "error" }),
    );
    await assertion;
    expect(useChromecastState.getState().casting).toBe(false);
  });
  it("bounds receiver startup and rejects controls after an account change", async () => {
    await controller.initialize();
    await controller.connect();
    const result = controller.play({
      item: { Id: "item", Name: "Film", Type: "Movie" },
      positionTicks: 0,
    });
    const assertion = expect(result).rejects.toThrow("did not confirm");
    await vi.advanceTimersByTimeAsync(20000);
    await assertion;
    vi.mocked(getJellyfinSession).mockReturnValue({
      ...owner,
      accessToken: "other",
    });
    expect(() => controller.command("Pause")).toThrow("account changed");
  });
  it("requires a configured Jellyfin receiver and a receiver-reachable server address", async () => {
    vi.mocked(jellyfinRequest).mockResolvedValue({});
    await expect(controller.initialize()).rejects.toThrow("receiver app ID");
    expect(() =>
      castServerAddress({ ...owner, serverAddress: undefined }),
    ).toThrow("can reach");
    expect(
      castServerAddress(
        { ...owner, serverAddress: "http://localhost:8096" },
        "http://192.168.1.2:8096",
      ),
    ).toBe("http://192.168.1.2:8096");
  });
  it("clamps receiver volume and removes listeners when disconnecting", async () => {
    await controller.initialize();
    await controller.connect();
    await controller.setVolume(4);
    expect(session.setReceiverVolumeLevel).toHaveBeenCalledWith(
      1,
      expect.any(Function),
      expect.any(Function),
    );
    await controller.disconnect(true);
    expect(session.stop).toHaveBeenCalledOnce();
    expect(session.removeMessageListener).toHaveBeenCalledWith(
      CAST_NAMESPACE,
      receive,
    );
    expect(useChromecastState.getState().connected).toBe(false);
  });
});
