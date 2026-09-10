import { create } from "zustand";

import { getJellyfinSession, jellyfinRequest } from "@/backend/jellyfin/client";
import { JellyfinSession } from "@/stores/jellyfin";

export const CAST_NAMESPACE = "urn:x-cast:com.connectsdk";
type CastError = { code?: string; description?: string };
type Failure = (error: CastError) => void;
export interface CastSession {
  receiver?: { friendlyName?: string; volume?: { level?: number } };
  addMessageListener(
    namespace: string,
    listener: (namespace: string, message: unknown) => void,
  ): void;
  removeMessageListener(
    namespace: string,
    listener: (namespace: string, message: unknown) => void,
  ): void;
  addUpdateListener(listener: (alive: boolean) => void): void;
  removeUpdateListener(listener: (alive: boolean) => void): void;
  sendMessage(
    namespace: string,
    message: string,
    success: () => void,
    failure: Failure,
  ): void;
  setReceiverVolumeLevel(
    level: number,
    success: () => void,
    failure: Failure,
  ): void;
  stop(success: () => void, failure: Failure): void;
  leave(success: () => void, failure: Failure): void;
}
export interface CastApi {
  isAvailable?: boolean;
  SessionRequest: new (id: string) => unknown;
  ApiConfig: new (
    request: unknown,
    session: (value: CastSession) => void,
    receiver: (availability: string) => void,
  ) => unknown;
  initialize(config: unknown, success: () => void, failure: Failure): void;
  requestSession(
    success: (session: CastSession) => void,
    failure: Failure,
  ): void;
}
type CastWindow = Window & {
  chrome?: { cast?: CastApi };
  __onGCastApiAvailable?: (available: boolean) => void;
};
export interface CastPlaybackState {
  ItemId?: string;
  NowPlayingItem?: {
    Id?: string;
    Name?: string;
    RunTimeTicks?: number;
    MediaStreams?: { Index: number; Type: string; DisplayTitle?: string }[];
  };
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
    VolumeLevel?: number;
    AudioStreamIndex?: number;
    SubtitleStreamIndex?: number;
  };
}
export const useChromecastState = create<{
  initialized: boolean;
  available: boolean;
  connected: boolean;
  casting: boolean;
  receiver: string;
  state: CastPlaybackState | null;
  error: string;
}>(() => ({
  initialized: false,
  available: false,
  connected: false,
  casting: false,
  receiver: "",
  state: null,
  error: "",
}));

let sdkPromise: Promise<CastApi> | null = null;
export function loadCastSdk(): Promise<CastApi> {
  const target = window as CastWindow;
  if (target.chrome?.cast?.isAvailable)
    return Promise.resolve(target.chrome.cast);
  if (sdkPromise) return sdkPromise;
  if (!window.isSecureContext)
    return Promise.reject(
      new Error("Google Cast needs HTTPS or localhost in a supported browser."),
    );
  sdkPromise = new Promise<CastApi>((resolve, reject) => {
    const previous = target.__onGCastApiAvailable;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (available: boolean) => {
      clearTimeout(timer);
      target.__onGCastApiAvailable = previous;
      if (available && target.chrome?.cast) resolve(target.chrome.cast);
      else reject(new Error("Google Cast is unavailable in this browser."));
    };
    target.__onGCastApiAvailable = (available) => {
      previous?.(available);
      finish(available);
    };
    timer = setTimeout(() => finish(false), 15000);
    const script = document.createElement("script");
    script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js";
    script.async = true;
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

export function castServerAddress(
  owner: JellyfinSession,
  localAddress?: string,
) {
  const address = owner.serverAddress ?? owner.serverUrl;
  const url = new URL(address, window.location.origin);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error(
      "The Jellyfin server address cannot be used by Google Cast.",
    );
  const local =
    ["localhost", "[::1]"].includes(url.hostname) ||
    url.hostname.startsWith("127.");
  if (local && localAddress)
    return castServerAddress({ ...owner, serverAddress: localAddress });
  if (local || !/^https?:\/\//i.test(address))
    throw new Error(
      "Choose a Jellyfin server address your cast device can reach.",
    );
  return url.toString().replace(/\/$/, "");
}

function sameOwner(owner: JellyfinSession) {
  try {
    const current = getJellyfinSession();
    return (
      current.accessToken === owner.accessToken &&
      current.serverUrl === owner.serverUrl &&
      current.deviceId === owner.deviceId
    );
  } catch {
    return false;
  }
}
function castFailure(error: CastError) {
  return new Error(
    error.code === "cancel"
      ? "Casting was cancelled."
      : "Google Cast could not complete the request. Check the receiver and its connection to Jellyfin.",
  );
}
export interface CastPlayOptions {
  item: { Id: string; Name: string; Type: string };
  positionTicks: number;
  mediaSourceId?: string;
  audioIndex?: number;
  subtitleIndex?: number;
  maxBitrate?: number;
}

export class JellyfinChromecast {
  private owner: JellyfinSession;

  constructor(owner = getJellyfinSession()) {
    this.owner = owner;
  }

  private session: CastSession | null = null;

  private api: CastApi | null = null;

  private address = "";

  private serverId = "";

  private serverVersion = "";

  private initPromise: Promise<void> | null = null;

  private pending: {
    itemId: string;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;

  private alive = true;

  private assertOwner() {
    if (!this.alive || !sameOwner(this.owner))
      throw new Error("Your Jellyfin account changed. Reconnect Google Cast.");
  }

  private onUpdate = (alive: boolean) => {
    if (!alive) {
      this.detach();
      this.pending?.reject(new Error("The cast receiver disconnected."));
      useChromecastState.setState({
        connected: false,
        casting: false,
        receiver: "",
        state: null,
      });
    }
  };

  private onMessage = (_namespace: string, message: unknown) => {
    if (!this.alive || !sameOwner(this.owner)) return;
    let parsed: { type?: string; data?: CastPlaybackState };
    try {
      parsed =
        typeof message === "string"
          ? JSON.parse(message)
          : (message as typeof parsed);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    if (["playbackerror", "connectionerror"].includes(parsed.type ?? "")) {
      const error = new Error(
        "The cast receiver could not play this title. Check its access to your Jellyfin server.",
      );
      useChromecastState.setState({ error: error.message });
      this.pending?.reject(error);
      return;
    }
    const data = parsed.data;
    if (!data || typeof data !== "object") return;
    if (parsed.type === "playbackstop") {
      useChromecastState.setState({ casting: false, state: data });
      return;
    }
    if (data.ItemId || data.NowPlayingItem?.Id) {
      useChromecastState.setState({ state: data });
      if (
        [
          "playbackstart",
          "playbackprogress",
          "timeupdate",
          "playstatechange",
        ].includes(parsed.type ?? "")
      ) {
        if (
          !this.pending ||
          this.pending.itemId === (data.ItemId ?? data.NowPlayingItem?.Id)
        ) {
          useChromecastState.setState({ casting: true, error: "" });
          this.pending?.resolve();
        }
      }
    }
  };

  private detach() {
    this.session?.removeMessageListener(CAST_NAMESPACE, this.onMessage);
    this.session?.removeUpdateListener(this.onUpdate);
    this.session = null;
  }

  private attach = (session: CastSession) => {
    if (!this.alive || !sameOwner(this.owner)) return;
    this.detach();
    this.session = session;
    session.addMessageListener(CAST_NAMESPACE, this.onMessage);
    session.addUpdateListener(this.onUpdate);
    useChromecastState.setState({
      connected: true,
      receiver: session.receiver?.friendlyName ?? "Google Cast",
      error: "",
    });
    this.command("Identify").catch((error: Error) =>
      useChromecastState.setState({ error: error.message }),
    );
  };

  initialize() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.assertOwner();
      const [user, info, api] = await Promise.all([
        jellyfinRequest<{
          Configuration?: { CastReceiverId?: string };
          Policy?: { EnableRemoteControlOfOtherUsers?: boolean };
        }>(`Users/${this.owner.userId}`),
        jellyfinRequest<{
          Id?: string;
          Version?: string;
          LocalAddress?: string;
        }>("System/Info/Public"),
        loadCastSdk(),
      ]);
      this.assertOwner();
      const receiverId = user.Configuration?.CastReceiverId;
      if (!receiverId)
        throw new Error(
          "Set a Google Cast receiver app ID in your Jellyfin playback settings before casting.",
        );
      this.address = castServerAddress(this.owner, info.LocalAddress);
      this.serverId = info.Id ?? this.owner.serverId ?? "";
      this.serverVersion = info.Version ?? "";
      this.api = api;
      await new Promise<void>((resolve, reject) => {
        api.initialize(
          new api.ApiConfig(
            new api.SessionRequest(receiverId),
            this.attach,
            (available) => {
              if (this.alive)
                useChromecastState.setState({
                  available: available === "available",
                });
            },
          ),
          resolve,
          (error) => reject(castFailure(error)),
        );
      });
      this.assertOwner();
      useChromecastState.setState({ initialized: true });
    })().catch((error) => {
      this.initPromise = null;
      throw error;
    });
    return this.initPromise;
  }

  async connect() {
    this.assertOwner();
    if (this.session) return;
    if (!this.api)
      throw new Error(
        "Google Cast is still loading. Try again when it is ready.",
      );
    await new Promise<void>((resolve, reject) => {
      this.api!.requestSession(
        (session) => {
          this.attach(session);
          resolve();
        },
        (error) => reject(castFailure(error)),
      );
    });
    this.assertOwner();
  }

  command(command: string, options: Record<string, unknown> = {}) {
    this.assertOwner();
    const session = this.session;
    if (!session)
      return Promise.reject(new Error("Connect to a cast receiver first."));
    const message = {
      command,
      options,
      userId: this.owner.userId,
      deviceId: this.owner.deviceId,
      accessToken: this.owner.accessToken,
      serverAddress: this.address,
      serverId: this.serverId,
      serverVersion: this.serverVersion,
      receiverName: session.receiver?.friendlyName,
      maxBitrate: options.maxBitrate,
    };
    return new Promise<void>((resolve, reject) => {
      session.sendMessage(
        CAST_NAMESPACE,
        JSON.stringify(message),
        resolve,
        (error) => reject(castFailure(error)),
      );
    });
  }

  async play(options: CastPlayOptions) {
    this.assertOwner();
    if (this.pending)
      throw new Error("Wait for the cast receiver to finish loading.");
    let timer: ReturnType<typeof setTimeout>;
    const ready = new Promise<void>((resolve, reject) => {
      this.pending = { itemId: options.item.Id, resolve, reject };
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "The cast receiver did not confirm playback. Check its connection to Jellyfin.",
            ),
          ),
        20000,
      );
    });
    // Attach a rejection handler immediately, including while the sender callback is pending.
    const send = this.command("PlayNow", {
      items: [
        {
          ...options.item,
          ServerId: this.serverId,
          MediaType: "Video",
          IsFolder: false,
        },
      ],
      startPositionTicks: Math.max(0, options.positionTicks),
      mediaSourceId: options.mediaSourceId,
      audioStreamIndex: options.audioIndex,
      subtitleStreamIndex: options.subtitleIndex,
      maxBitrate: options.maxBitrate,
    });
    try {
      await Promise.all([send, ready]);
    } finally {
      clearTimeout(timer!);
      this.pending = null;
    }
  }

  async setVolume(level: number) {
    this.assertOwner();
    const session = this.session;
    if (!session) return;
    await new Promise<void>((resolve, reject) => {
      session.setReceiverVolumeLevel(
        Math.max(0, Math.min(1, level)),
        resolve,
        (error) => reject(castFailure(error)),
      );
    });
  }

  async disconnect(stop: boolean) {
    const session = this.session;
    if (!session) return;
    await new Promise<void>((resolve, reject) => {
      session[stop ? "stop" : "leave"](resolve, (error) =>
        reject(castFailure(error)),
      );
    });
    this.onUpdate(false);
  }

  dispose() {
    this.alive = false;
    this.pending?.reject(new Error("The cast controls were closed."));
    this.session?.leave(
      () => {},
      () => {},
    );
    this.detach();
    useChromecastState.setState({
      initialized: false,
      available: false,
      connected: false,
      casting: false,
      receiver: "",
      state: null,
      error: "",
    });
  }
}
