/* eslint-disable import/no-extraneous-dependencies */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useJellyfinAuth } from "@/stores/jellyfin";
import {
  persistentSessionStorage,
  syncSessionAcrossTabs,
} from "@/stores/persistentSession";
import { useSeerrConnection } from "@/stores/seerr";

const session = {
  serverUrl: "/jellyfin",
  accessToken: "test-session-token",
  userId: "test-user",
  userName: "Test user",
  deviceId: "test-device",
};

beforeEach(() => {
  useJellyfinAuth.getState().setSession(null);
  useSeerrConnection.getState().setConnection(null);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("persistent login sessions", () => {
  it("restores Jellyfin and Seerr after the old tab storage has gone", async () => {
    const connection = {
      url: "https://seerr.example",
      apiUrl: "/seerr/api/v1",
      authMethod: "jellyfin" as const,
      jellyfinServerUrl: session.serverUrl,
      jellyfinUserId: session.userId,
      jellyfinAccessToken: session.accessToken,
    };
    useJellyfinAuth.getState().setSession(session);
    useSeerrConnection.getState().setConnection(connection);
    const auth = localStorage.getItem("jellyfin-session")!;
    const seerr = localStorage.getItem("seerr-connection")!;
    expect(sessionStorage.getItem("jellyfin-session")).toBeNull();
    expect(sessionStorage.getItem("seerr-connection")).toBeNull();

    useJellyfinAuth.getState().setSession(null);
    useSeerrConnection.getState().setConnection(null);
    sessionStorage.clear();
    localStorage.setItem("jellyfin-session", auth);
    localStorage.setItem("seerr-connection", seerr);
    await useJellyfinAuth.persist.rehydrate();
    await useSeerrConnection.persist.rehydrate();
    expect(useJellyfinAuth.getState().session).toEqual(session);
    expect(useSeerrConnection.getState().connection).toEqual(connection);
  });

  it("migrates an existing tab login and removes its obsolete copy", async () => {
    sessionStorage.setItem(
      "jellyfin-session",
      JSON.stringify({ state: { session }, version: 0 }),
    );
    await useJellyfinAuth.persist.rehydrate();
    expect(useJellyfinAuth.getState().session).toEqual(session);
    expect(localStorage.getItem("jellyfin-session")).toContain(
      session.accessToken,
    );
    expect(sessionStorage.getItem("jellyfin-session")).toBeNull();
  });

  it("does not resurrect an old tab login after a shared logout", async () => {
    useJellyfinAuth.getState().setSession(null);
    sessionStorage.setItem(
      "jellyfin-session",
      JSON.stringify({ state: { session }, version: 0 }),
    );
    await useJellyfinAuth.persist.rehydrate();
    expect(useJellyfinAuth.getState().session).toBeNull();
    expect(sessionStorage.getItem("jellyfin-session")).toBeNull();
  });

  it("applies a logout from another tab immediately", () => {
    useJellyfinAuth.getState().setSession(session);
    const value = JSON.stringify({ state: { session: null }, version: 0 });
    localStorage.setItem("jellyfin-session", value);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "jellyfin-session",
        newValue: value,
        storageArea: localStorage,
      }),
    );
    expect(useJellyfinAuth.getState().session).toBeNull();
  });

  it("signs out when another tab clears browser storage", () => {
    useJellyfinAuth.getState().setSession(session);
    localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", { key: null, storageArea: localStorage }),
    );
    expect(useJellyfinAuth.getState().session).toBeNull();
  });

  it("ignores unrelated settings and tab-only storage events", () => {
    const restore = vi.fn();
    const clear = vi.fn();
    const stop = syncSessionAcrossTabs("example-session", restore, clear);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "theme",
        storageArea: localStorage,
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "example-session",
        storageArea: sessionStorage,
      }),
    );
    expect(restore).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    stop();
  });

  it("removes both copies when a session is deleted", () => {
    localStorage.setItem("example-session", "saved");
    sessionStorage.setItem("example-session", "old");
    persistentSessionStorage.removeItem("example-session");
    expect(localStorage.getItem("example-session")).toBeNull();
    expect(sessionStorage.getItem("example-session")).toBeNull();
  });
});
