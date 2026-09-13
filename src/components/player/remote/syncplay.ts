import { create } from "zustand";

import {
  getJellyfinSession,
  jellyfinRequest,
  jellyfinUrl,
} from "@/backend/jellyfin/client";
import { JellyfinSession } from "@/stores/jellyfin";

export interface SyncPlayGroup {
  GroupId: string;
  GroupName: string;
  State: string;
  Participants: string[];
  LastUpdatedAt: string;
}
export interface SyncPlayQueue {
  Reason: string;
  LastUpdate: string;
  Playlist: { ItemId: string; PlaylistItemId: string }[];
  PlayingItemIndex: number;
  StartPositionTicks: number;
  IsPlaying: boolean;
}
export interface SyncPlayCommand {
  GroupId: string;
  PlaylistItemId: string;
  When: string;
  EmittedAt: string;
  Command: "Unpause" | "Pause" | "Seek" | "Stop";
  PositionTicks?: number;
}
export interface SyncPlayPlayer {
  snapshot: () => {
    itemId?: string;
    seconds: number;
    playing: boolean;
    ready: boolean;
    rate: number;
  };
  pause: () => void;
  play: () => void;
  seek: (seconds: number) => void;
  rate: (value: number) => void;
  load: (itemId: string, positionTicks: number) => void;
}
export const useSyncPlayState = create<{
  connected: boolean;
  access: "CreateAndJoinGroups" | "JoinGroups" | "None" | null;
  group: SyncPlayGroup | null;
  queue: SyncPlayQueue | null;
  error: string;
  ping: number;
}>(() => ({
  connected: false,
  access: null,
  group: null,
  queue: null,
  error: "",
  ping: 0,
}));

export function clockMeasurement(
  sent: number,
  received: number,
  serverReceived: string,
  serverSent: string,
) {
  const reception = Date.parse(serverReceived);
  const transmission = Date.parse(serverSent);
  if (![sent, received, reception, transmission].every(Number.isFinite))
    throw new Error("Jellyfin returned an invalid clock response.");
  const delay = Math.max(0, received - sent - (transmission - reception));
  return {
    offset: (reception - sent + (transmission - received)) / 2,
    delay,
    ping: Math.round(delay / 2),
  };
}
export function syncPlaySocketUrl() {
  const session = getJellyfinSession();
  const url = new URL(
    jellyfinUrl("socket", {
      ApiKey: session.accessToken,
      deviceId: session.deviceId,
    }),
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
const TICKS = 10_000_000;
function currentQueueItem() {
  const queue = useSyncPlayState.getState().queue;
  return queue?.Playlist[queue.PlayingItemIndex];
}

export class JellyfinSyncPlay {
  private owner: JellyfinSession;

  private player: SyncPlayPlayer;

  private socket: WebSocket | null = null;

  private initialization: Promise<void> | null = null;

  private alive = true;

  private cancelConnect?: () => void;

  private clock = { offset: 0, delay: Infinity, ping: 0 };

  private samples: (typeof this.clock)[] = [];

  private clockTimer?: ReturnType<typeof setInterval>;

  private keepAliveTimer?: ReturnType<typeof setInterval>;

  private commandTimer?: ReturnType<typeof setTimeout>;

  private latestCommand: SyncPlayCommand | null = null;

  private enabledAt = 0;

  private commandPending = false;

  private awaitingReady = false;

  private reportedReady = false;

  private bufferingSince = 0;

  private savedRate = 1;

  private lastCorrection = 0;

  private joining: {
    id: string;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(player: SyncPlayPlayer, owner = getJellyfinSession()) {
    this.player = player;
    this.owner = owner;
  }

  private assertOwner() {
    const current = getJellyfinSession();
    if (
      !this.alive ||
      current.accessToken !== this.owner.accessToken ||
      current.serverUrl !== this.owner.serverUrl ||
      current.deviceId !== this.owner.deviceId
    )
      throw new Error("Your Jellyfin account changed. Rejoin SyncPlay.");
  }

  private request<T = void>(action: string, body?: unknown) {
    this.assertOwner();
    return jellyfinRequest<T>(`SyncPlay/${action}`, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private fail(error: unknown) {
    if (this.alive)
      useSyncPlayState.setState({
        error:
          error instanceof Error
            ? error.message
            : "SyncPlay could not complete the request.",
      });
  }

  private serverNow() {
    return Date.now() + this.clock.offset;
  }

  async measureClock() {
    this.assertOwner();
    const sent = Date.now();
    const response = await jellyfinRequest<{
      RequestReceptionTime: string;
      ResponseTransmissionTime: string;
    }>("GetUtcTime");
    this.assertOwner();
    const sample = clockMeasurement(
      sent,
      Date.now(),
      response.RequestReceptionTime,
      response.ResponseTransmissionTime,
    );
    this.samples = [...this.samples.slice(-7), sample];
    this.clock = this.samples.reduce((best, value) =>
      value.delay < best.delay ? value : best,
    );
    useSyncPlayState.setState({ ping: this.clock.ping });
    if (useSyncPlayState.getState().group)
      await this.request("Ping", { Ping: this.clock.ping });
  }

  initialize() {
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      this.assertOwner();
      const user = await jellyfinRequest<{
        Policy?: {
          SyncPlayAccess?: "CreateAndJoinGroups" | "JoinGroups" | "None";
        };
      }>(`Users/${this.owner.userId}`);
      this.assertOwner();
      const access = user.Policy?.SyncPlayAccess ?? "None";
      useSyncPlayState.setState({ access });
      if (access === "None")
        throw new Error("SyncPlay is disabled for your Jellyfin account.");
      await Promise.all([this.connect(), this.measureClock()]);
      this.assertOwner();
      this.clockTimer = setInterval(() => {
        this.measureClock().catch((error) => this.fail(error));
      }, 60000);
    })().catch((error) => {
      this.initialization = null;
      this.closeSocket();
      throw error;
    });
    return this.initialization;
  }

  private connect() {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(syncPlaySocketUrl());
      this.socket = socket;
      const timer = setTimeout(() => {
        reject(
          new Error(
            "Jellyfin's SyncPlay connection timed out. Check WebSocket support on your server proxy.",
          ),
        );
        socket.close();
      }, 10000);
      this.cancelConnect = () => {
        clearTimeout(timer);
        reject(new Error("SyncPlay connection was closed."));
      };
      socket.onopen = () => {
        this.cancelConnect = undefined;
        clearTimeout(timer);
        if (!this.alive) {
          socket.close();
          return;
        }
        useSyncPlayState.setState({ connected: true, error: "" });
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error(
            "Could not connect to Jellyfin SyncPlay. Check WebSocket support on your server proxy.",
          ),
        );
      };
      socket.onclose = () => {
        clearTimeout(timer);
        if (this.socket !== socket) return;
        this.socket = null;
        this.initialization = null;
        clearInterval(this.keepAliveTimer);
        clearInterval(this.clockTimer);
        if (useSyncPlayState.getState().group) {
          this.player.pause();
          this.resetGroup();
          this.fail(
            new Error(
              "SyncPlay disconnected. Rejoin the group to continue together.",
            ),
          );
        }
        useSyncPlayState.setState({ connected: false });
        this.joining?.reject(
          new Error("SyncPlay disconnected before joining the group."),
        );
        reject(new Error("SyncPlay disconnected."));
      };
      socket.onmessage = (event) => {
        if (!this.alive) return;
        try {
          this.receive(JSON.parse(String(event.data)));
        } catch {
          /* Ignore unrelated or malformed socket messages. */
        }
      };
    });
  }

  private keepAlive(timeoutSeconds: unknown) {
    const seconds =
      typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds)
        ? timeoutSeconds
        : 60;
    const send = () => {
      if (this.socket?.readyState === WebSocket.OPEN)
        this.socket.send(JSON.stringify({ MessageType: "KeepAlive" }));
    };
    clearInterval(this.keepAliveTimer);
    send();
    this.keepAliveTimer = setInterval(
      send,
      Math.max(1000, Math.min(30000, seconds * 500)),
    );
  }

  receive(message: { MessageType?: string; Data?: unknown }) {
    this.assertOwner();
    if (message.MessageType === "ForceKeepAlive") {
      this.keepAlive(message.Data);
      return;
    }
    if (message.MessageType === "SyncPlayCommand") {
      this.processCommand(message.Data as SyncPlayCommand);
      return;
    }
    if (message.MessageType !== "SyncPlayGroupUpdate") return;
    const update = message.Data as {
      Type: string;
      GroupId: string;
      Data?: unknown;
    };
    if (!update || typeof update !== "object") return;
    if (update.Type === "GroupJoined") {
      const group = update.Data as SyncPlayGroup;
      if (!group?.GroupId || !Array.isArray(group.Participants)) return;
      if (this.joining && this.joining.id !== group.GroupId) return;
      this.enableGroup(group);
      this.joining?.resolve();
      return;
    }
    if (
      ["NotInGroup", "GroupLeft"].includes(update.Type) &&
      (!update.GroupId ||
        update.GroupId === useSyncPlayState.getState().group?.GroupId)
    ) {
      this.resetGroup();
      return;
    }
    if (
      [
        "LibraryAccessDenied",
        "GroupDoesNotExist",
        "CreateGroupDenied",
        "JoinGroupDenied",
        "SyncPlayIsDisabled",
      ].includes(update.Type)
    ) {
      const error = new Error(
        update.Type === "LibraryAccessDenied"
          ? "Your Jellyfin account cannot access this group's content."
          : "Jellyfin did not allow this SyncPlay action. Refresh the group list and check your permissions.",
      );
      this.fail(error);
      this.joining?.reject(error);
      return;
    }
    const current = useSyncPlayState.getState().group;
    if (!current || current.GroupId !== update.GroupId) return;
    if (update.Type === "PlayQueue")
      this.processQueue(update.Data as SyncPlayQueue);
    if (update.Type === "GroupUpdate")
      useSyncPlayState.setState({ group: update.Data as SyncPlayGroup });
    if (update.Type === "UserJoined" || update.Type === "UserLeft") {
      const name = String(update.Data);
      useSyncPlayState.setState({
        group: {
          ...current,
          Participants:
            update.Type === "UserJoined"
              ? [...new Set([...current.Participants, name])]
              : current.Participants.filter(
                  (participant) => participant !== name,
                ),
        },
      });
    }
    if (update.Type === "StateUpdate")
      useSyncPlayState.setState({
        group: { ...current, State: (update.Data as { State: string }).State },
      });
  }

  private enableGroup(group: SyncPlayGroup) {
    if (useSyncPlayState.getState().group?.GroupId === group.GroupId) return;
    if (!useSyncPlayState.getState().group)
      this.savedRate = this.player.snapshot().rate;
    this.enabledAt = Date.parse(group.LastUpdatedAt) || this.serverNow();
    this.player.rate(1);
    useSyncPlayState.setState({ group, error: "" });
    this.request("Ping", { Ping: this.clock.ping }).catch((error) =>
      this.fail(error),
    );
  }

  async list() {
    await this.initialize();
    this.assertOwner();
    return jellyfinRequest<SyncPlayGroup[]>("SyncPlay/List");
  }

  async create(name: string, itemIds: string[], positionTicks: number) {
    await this.initialize();
    if (useSyncPlayState.getState().access !== "CreateAndJoinGroups")
      throw new Error(
        "Your Jellyfin account can join groups but cannot create them.",
      );
    if (!name.trim() || !itemIds.length)
      throw new Error("Choose a group name and a playable title.");
    const group = await this.request<SyncPlayGroup>("New", {
      GroupName: name.trim(),
    });
    this.assertOwner();
    if (group?.GroupId) this.enableGroup(group);
    if (!useSyncPlayState.getState().group)
      throw new Error("Jellyfin did not confirm the new group.");
    await this.request("SetNewQueue", {
      PlayingQueue: itemIds,
      PlayingItemPosition: 0,
      StartPositionTicks: Math.max(0, Math.round(positionTicks)),
    });
  }

  async join(id: string) {
    await this.initialize();
    let timer: ReturnType<typeof setTimeout>;
    const joined = new Promise<void>((resolve, reject) => {
      this.joining = { id, resolve, reject };
      timer = setTimeout(
        () =>
          reject(
            new Error("Jellyfin did not confirm joining the group. Try again."),
          ),
        10000,
      );
    });
    try {
      await Promise.all([this.request("Join", { GroupId: id }), joined]);
    } finally {
      clearTimeout(timer!);
      this.joining = null;
    }
  }

  async selectItem(id: string, ticks = 0) {
    if (!useSyncPlayState.getState().group) return;
    await this.request("SetNewQueue", {
      PlayingQueue: [id],
      PlayingItemPosition: 0,
      StartPositionTicks: Math.max(0, Math.round(ticks)),
    });
  }

  async leave() {
    if (useSyncPlayState.getState().group) await this.request("Leave");
    this.resetGroup();
  }

  action(
    action: "Pause" | "Unpause" | "Seek" | "Stop" | "NextItem" | "PreviousItem",
    seconds?: number,
  ) {
    if (!useSyncPlayState.getState().group) return;
    if (action === "Pause") this.player.pause();
    const data =
      action === "Seek"
        ? { PositionTicks: Math.round(Math.max(0, seconds ?? 0) * TICKS) }
        : ["NextItem", "PreviousItem"].includes(action)
          ? { PlaylistItemId: currentQueueItem()?.PlaylistItemId }
          : undefined;
    this.request(action, data).catch((error) => this.fail(error));
  }

  private processQueue(queue: SyncPlayQueue) {
    if (
      !queue ||
      !Array.isArray(queue.Playlist) ||
      !Number.isFinite(queue.PlayingItemIndex)
    )
      return;
    const previous = useSyncPlayState.getState().queue;
    if (
      previous &&
      Date.parse(queue.LastUpdate) <= Date.parse(previous.LastUpdate)
    )
      return;
    const oldId = currentQueueItem()?.PlaylistItemId;
    useSyncPlayState.setState({ queue });
    const item = currentQueueItem();
    if (!item) {
      this.player.pause();
      this.latestCommand = null;
      clearTimeout(this.commandTimer);
      return;
    }
    if (item.PlaylistItemId === oldId && queue.Reason !== "NewPlaylist") return;
    clearTimeout(this.commandTimer);
    this.latestCommand = null;
    this.awaitingReady = true;
    this.reportedReady = false;
    this.bufferingSince = 0;
    this.player.pause();
    const position = Math.max(
      0,
      queue.StartPositionTicks +
        (queue.IsPlaying
          ? Math.max(0, this.serverNow() - Date.parse(queue.LastUpdate)) * 10000
          : 0),
    );
    if (this.player.snapshot().itemId === item.ItemId)
      this.player.seek(position / TICKS);
    else this.player.load(item.ItemId, Math.round(position));
  }

  private processCommand(command: SyncPlayCommand) {
    if (
      !command ||
      !["Unpause", "Pause", "Seek", "Stop"].includes(command.Command)
    )
      return;
    const group = useSyncPlayState.getState().group;
    if (
      !group ||
      command.GroupId !== group.GroupId ||
      Date.parse(command.EmittedAt) < this.enabledAt
    )
      return;
    if (
      !Number.isFinite(Date.parse(command.When)) ||
      !Number.isFinite(Date.parse(command.EmittedAt))
    )
      return;
    if (
      command.Command !== "Stop" &&
      command.PlaylistItemId !== currentQueueItem()?.PlaylistItemId
    )
      return;
    if (
      this.latestCommand &&
      Date.parse(command.EmittedAt) < Date.parse(this.latestCommand.EmittedAt)
    )
      return;
    if (
      this.latestCommand &&
      command.Command === this.latestCommand.Command &&
      command.When === this.latestCommand.When &&
      command.PositionTicks === this.latestCommand.PositionTicks &&
      this.commandTimer
    )
      return;
    this.latestCommand = command;
    this.commandPending = false;
    clearTimeout(this.commandTimer);
    this.commandTimer = undefined;
    if (
      command.Command !== "Stop" &&
      (!this.player.snapshot().ready ||
        this.player.snapshot().itemId !== currentQueueItem()?.ItemId)
    ) {
      this.commandPending = true;
      return;
    }
    const apply = () => {
      this.commandTimer = undefined;
      if (!useSyncPlayState.getState().group) return;
      this.player.rate(1);
      const target = Math.max(0, (command.PositionTicks ?? 0) / TICKS);
      if (command.Command === "Unpause") {
        const position =
          target +
          Math.max(0, this.serverNow() - Date.parse(command.When)) / 1000;
        if (Math.abs(this.player.snapshot().seconds - position) > 0.4)
          this.player.seek(position);
        this.awaitingReady = false;
        this.player.play();
        this.lastCorrection = Date.now();
      } else {
        this.player.pause();
        if (command.Command !== "Stop") {
          this.player.seek(target);
          this.awaitingReady = true;
          this.reportedReady = false;
        }
      }
    };
    const delay = Date.parse(command.When) - this.serverNow();
    if (delay > 0)
      this.commandTimer = setTimeout(apply, Math.min(delay, 2147483647));
    else apply();
  }

  /** Call on media readiness changes and periodically while joined. */
  tick() {
    if (!useSyncPlayState.getState().group || !currentQueueItem()) return;
    const snapshot = this.player.snapshot();
    if (snapshot.itemId !== currentQueueItem()?.ItemId) return;
    if (snapshot.ready) {
      this.bufferingSince = 0;
      if (!this.reportedReady) {
        if (this.awaitingReady) this.player.pause();
        this.reportedReady = true;
        this.awaitingReady = false;
        this.reportBuffer(false);
        if (this.latestCommand && this.commandPending)
          this.processCommand(this.latestCommand);
      }
      const command = this.latestCommand;
      if (
        snapshot.playing &&
        command?.Command === "Unpause" &&
        Date.now() - this.lastCorrection > 3000
      ) {
        const expected =
          (command.PositionTicks ?? 0) / TICKS +
          (this.serverNow() - Date.parse(command.When)) / 1000;
        const difference = expected - snapshot.seconds;
        if (Math.abs(difference) > 2) {
          this.player.seek(Math.max(0, expected));
          this.lastCorrection = Date.now();
        } else
          this.player.rate(
            Math.abs(difference) > 0.15
              ? Math.max(0.95, Math.min(1.05, 1 + difference / 10))
              : 1,
          );
      }
    } else {
      if (!this.bufferingSince) this.bufferingSince = Date.now();
      if (this.reportedReady && Date.now() - this.bufferingSince >= 3000) {
        this.reportedReady = false;
        this.reportBuffer(true);
      }
    }
  }

  private reportBuffer(buffering: boolean) {
    const snapshot = this.player.snapshot();
    this.request(buffering ? "Buffering" : "Ready", {
      When: new Date(this.serverNow()).toISOString(),
      PositionTicks: Math.round(snapshot.seconds * TICKS),
      IsPlaying: snapshot.playing,
      PlaylistItemId: currentQueueItem()?.PlaylistItemId,
    }).catch((error) => this.fail(error));
  }

  private resetGroup() {
    clearTimeout(this.commandTimer);
    this.commandTimer = undefined;
    this.latestCommand = null;
    this.awaitingReady = false;
    this.reportedReady = false;
    if (useSyncPlayState.getState().group) this.player.rate(this.savedRate);
    useSyncPlayState.setState({ group: null, queue: null });
  }

  private closeSocket() {
    clearInterval(this.keepAliveTimer);
    clearInterval(this.clockTimer);
    this.cancelConnect?.();
    this.cancelConnect = undefined;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    if (this.alive) useSyncPlayState.setState({ connected: false });
  }

  dispose() {
    if (this.alive && useSyncPlayState.getState().group) {
      try {
        this.request("Leave").catch(() => {});
      } catch {
        /* Account was already cleared. */
      }
    }
    this.alive = false;
    this.joining?.reject(new Error("SyncPlay was closed."));
    this.resetGroup();
    this.closeSocket();
    useSyncPlayState.setState({
      access: null,
      connected: false,
      error: "",
      ping: 0,
    });
  }
}
