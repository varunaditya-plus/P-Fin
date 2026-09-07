// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

import {
  getAppSettings,
  saveAppSettings,
} from "@/backend/jellyfin/appSettings";
import { JellyfinSession } from "@/stores/jellyfin";

import {
  exportAppPreferences,
  importAppPreferences,
  registerAppPreferenceSection,
} from "./registry";
import { accountPreferencesKey, startAccountPreferencesSync } from "./sync";

vi.mock("@/backend/jellyfin/appSettings", () => ({
  getAppSettings: vi.fn(),
  saveAppSettings: vi.fn(),
}));
const session: JellyfinSession = {
  serverUrl: "/jellyfin",
  serverId: "server",
  userId: "user",
  accessToken: "secret-not-exported",
  userName: "User",
  deviceId: "device",
};
const store = create(() => ({ value: 1 }));
const cleanups: (() => void)[] = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function register(name = "example") {
  cleanups.push(
    registerAppPreferenceSection(name, {
      defaults: { value: 1 },
      getSnapshot: store.getState,
      apply: store.setState,
      subscribe: store.subscribe,
      validate: (value) => {
        const input = value as { value?: unknown };
        if (typeof input?.value !== "number") throw new Error("Invalid value");
        return { value: input.value };
      },
    }),
  );
}
describe("account preference sync and backups", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    localStorage.clear();
    store.setState({ value: 1 });
    vi.mocked(saveAppSettings).mockResolvedValue({});
    register();
  });
  afterEach(() => {
    cleanups.reverse().forEach((cleanup) => cleanup());
    cleanups.length = 0;
    vi.useRealTimers();
  });
  it("keeps edits made while the server loads and uploads those edits", async () => {
    const remote = deferred<Record<string, unknown>>();
    vi.mocked(getAppSettings).mockReturnValue(remote.promise);
    cleanups.push(startAccountPreferencesSync(session));
    store.setState({ value: 7 });
    remote.resolve({ example: { value: 2 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().value).toBe(7);
    expect(saveAppSettings).toHaveBeenCalledWith(
      { example: { value: 7 } },
      session,
      expect.any(AbortSignal),
    );
  });
  it("retains newer edits while an earlier save is pending", async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ example: { value: 2 } });
    cleanups.push(startAccountPreferencesSync(session));
    await vi.advanceTimersByTimeAsync(0);
    const write = deferred<Record<string, unknown>>();
    vi.mocked(saveAppSettings).mockReturnValueOnce(write.promise);
    store.setState({ value: 3 });
    await vi.advanceTimersByTimeAsync(800);
    store.setState({ value: 4 });
    write.resolve({});
    await vi.advanceTimersByTimeAsync(800);
    expect(
      vi
        .mocked(saveAppSettings)
        .mock.calls.map(([sections]) => sections.example),
    ).toEqual([{ value: 3 }, { value: 4 }]);
    expect(
      JSON.parse(localStorage.getItem(accountPreferencesKey(session))!).dirty,
    ).toEqual([]);
  });
  it("isolates local settings by account and ignores disposed account responses", async () => {
    const remote = deferred<Record<string, unknown>>();
    vi.mocked(getAppSettings)
      .mockReturnValueOnce(remote.promise)
      .mockResolvedValue({ example: { value: 8 } });
    const stop = startAccountPreferencesSync(session);
    store.setState({ value: 9 });
    stop();
    cleanups.push(startAccountPreferencesSync({ ...session, userId: "other" }));
    expect(store.getState().value).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    remote.resolve({ example: { value: 3 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().value).toBe(8);
    expect(
      JSON.parse(localStorage.getItem(accountPreferencesKey(session))!).sections
        .example,
    ).toEqual({ value: 9 });
  });
  it("only exports registered values and validates all selected groups before importing", () => {
    register("second");
    const output = exportAppPreferences(["example"]);
    expect(JSON.parse(output).sections).toEqual({ example: { value: 1 } });
    expect(output).not.toContain(session.accessToken);
    expect(output).not.toContain("serverUrl");
    expect(() =>
      importAppPreferences(
        {
          format: "movie-fin-settings",
          version: 1,
          sections: { example: { value: 3 }, second: { value: "invalid" } },
        },
        ["example", "second"],
      ),
    ).toThrow("Invalid");
    expect(store.getState().value).toBe(1);
    importAppPreferences(
      {
        format: "movie-fin-settings",
        version: 1,
        sections: {
          example: { value: 3 },
          second: { value: "invalid" },
          token: session.accessToken,
        },
      },
      ["example"],
    );
    expect(store.getState().value).toBe(3);
  });
  it("keeps offline edits pending and uploads them when retried", async () => {
    vi.mocked(getAppSettings)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ example: { value: 2 } });
    cleanups.push(startAccountPreferencesSync(session));
    await vi.advanceTimersByTimeAsync(0);
    store.setState({ value: 6 });
    await vi.advanceTimersByTimeAsync(800);
    expect(store.getState().value).toBe(6);
    expect(saveAppSettings).toHaveBeenCalledWith(
      { example: { value: 6 } },
      session,
      expect.any(AbortSignal),
    );
  });
  it("does not throw into UI events or upload invalid active drafts", async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ example: { value: 2 } });
    cleanups.push(startAccountPreferencesSync(session));
    await vi.advanceTimersByTimeAsync(0);
    expect(() =>
      store.setState({ value: "draft" as unknown as number }),
    ).not.toThrow();
    await vi.advanceTimersByTimeAsync(800);
    expect(saveAppSettings).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem(accountPreferencesKey(session))!).sections
        .example,
    ).toEqual({ value: 2 });
  });
});
