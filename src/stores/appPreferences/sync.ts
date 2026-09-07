import { create } from "zustand";

import {
  AppSettingsSections,
  getAppSettings,
  saveAppSettings,
} from "@/backend/jellyfin/appSettings";
import { JellyfinSession } from "@/stores/jellyfin";

import {
  getAppPreferenceSections,
  subscribePreferenceRegistry,
} from "./registry";

interface LocalSettings {
  sections: AppSettingsSections;
  dirty: string[];
}
export function accountPreferencesKey(session: JellyfinSession) {
  return `movie-fin:settings:v1:${JSON.stringify([session.serverId || session.serverAddress || session.serverUrl, session.userId])}`;
}
export const useAppPreferencesSync = create<{
  status: "loading" | "saved" | "pending" | "error";
  error: string;
  retry: () => void;
}>(() => ({ status: "loading", error: "", retry: () => {} }));

/** Account identity is captured once; disposal prevents responses from touching another account. */
export function startAccountPreferencesSync(session: JellyfinSession) {
  const key = accountPreferencesKey(session);
  let local: LocalSettings = { sections: {}, dirty: [] };
  let hasCache = false;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      parsed &&
      parsed.sections &&
      typeof parsed.sections === "object" &&
      !Array.isArray(parsed.sections) &&
      Array.isArray(parsed.dirty)
    ) {
      local = {
        sections: parsed.sections,
        dirty: parsed.dirty.filter((name: unknown) => typeof name === "string"),
      };
      hasCache = true;
    }
  } catch {
    /* Invalid local data is replaced by validated defaults or the server. */
  }
  const values: AppSettingsSections = { ...local.sections };
  const dirty = new Set(local.dirty);
  const generations = new Map<string, number>();
  const subscriptions = new Map<string, () => void>();
  const controller = new AbortController();
  let applying = false;
  let disposed = false;
  let busy = false;
  let hydrated = false;
  const hasPending = () =>
    [...dirty].some((name) => getAppPreferenceSections().has(name));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let storageError = "";
  let migrate = false;
  try {
    migrate = !hasCache && !localStorage.getItem("movie-fin:settings:migrated");
    localStorage.setItem("movie-fin:settings:migrated", "1");
  } catch {
    /* Private browsing can deny persistent storage; server sync still works. */
  }
  const legacy: AppSettingsSections = {};
  if (migrate)
    getAppPreferenceSections().forEach((section, name) => {
      try {
        legacy[name] = section.validate(section.getSnapshot());
      } catch {
        /* Invalid legacy values fall back to this account's defaults. */
      }
    });
  const status = (
    state: "loading" | "saved" | "pending" | "error",
    error = "",
  ) => {
    if (!disposed)
      useAppPreferencesSync.setState({
        status: storageError ? "error" : state,
        error: storageError || error,
      });
  };
  const persistLocal = () => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ sections: values, dirty: [...dirty] }),
      );
      storageError = "";
    } catch {
      storageError =
        "This browser could not save settings locally. Settings will still sync with Jellyfin when available.";
    }
  };
  const applySection = (name: string, raw: unknown) => {
    const section = getAppPreferenceSections().get(name);
    if (!section) return;
    const checked = section.validate(raw);
    applying = true;
    try {
      section.apply(checked);
      values[name] = checked;
    } finally {
      applying = false;
    }
  };
  const request = async <T>(operation: (signal: AbortSignal) => Promise<T>) => {
    const child = new AbortController();
    const abort = () => child.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 30000);
    try {
      return await operation(child.signal);
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", abort);
    }
  };
  const sync = async () => {
    if (disposed || busy) return;
    busy = true;
    status(hydrated ? "pending" : "loading");
    try {
      if (!hydrated) {
        const remote = await request((signal) =>
          getAppSettings(session, signal),
        );
        if (disposed) return;
        for (const [name, value] of Object.entries(remote)) {
          if (dirty.has(name)) continue;
          if (!getAppPreferenceSections().has(name)) {
            values[name] = value;
            continue;
          }
          try {
            applySection(name, value);
          } catch {
            /* Unsupported remote groups remain untouched until the user edits them. */
          }
        }
        for (const name of getAppPreferenceSections().keys()) {
          if (!Object.hasOwn(remote, name)) dirty.add(name);
        }
        hydrated = true;
        persistLocal();
      }
      if (dirty.size) {
        const pending = [...dirty].filter((name) =>
          getAppPreferenceSections().has(name),
        );
        const sent = Object.fromEntries(
          pending.map((name) => [name, values[name]]),
        );
        const versions = new Map(generations);
        if (pending.length)
          await request((signal) => saveAppSettings(sent, session, signal));
        if (disposed) return;
        pending.forEach((name) => {
          if (versions.get(name) === generations.get(name)) dirty.delete(name);
        });
        persistLocal();
      }
      status(hasPending() ? "pending" : "saved");
    } catch (reason) {
      if (!disposed)
        status(
          "error",
          reason instanceof Error
            ? reason.message
            : "Settings could not sync with Jellyfin. Local changes are kept on this device.",
        );
    } finally {
      busy = false;
      if (
        !disposed &&
        hasPending() &&
        useAppPreferencesSync.getState().status !== "error"
      )
        timer = setTimeout(sync, 800);
    }
  };
  const attachSections = () => {
    for (const [name, unsubscribe] of subscriptions) {
      if (!getAppPreferenceSections().has(name)) {
        unsubscribe();
        subscriptions.delete(name);
      }
    }
    getAppPreferenceSections().forEach((section, name) => {
      if (subscriptions.has(name)) return;
      try {
        applySection(
          name,
          values[name] ??
            section.localFallback?.() ??
            legacy[name] ??
            section.defaults,
        );
      } catch {
        applySection(name, section.defaults);
        dirty.delete(name);
      }
      subscriptions.set(
        name,
        section.subscribe(() => {
          if (applying || disposed) return;
          let value: unknown;
          try {
            value = section.validate(section.getSnapshot());
          } catch (reason) {
            status(
              "error",
              reason instanceof Error
                ? reason.message
                : "Some settings are invalid and could not be saved.",
            );
            return;
          }
          if (JSON.stringify(value) === JSON.stringify(values[name])) return;
          values[name] = value;
          dirty.add(name);
          generations.set(name, (generations.get(name) ?? 0) + 1);
          persistLocal();
          status("pending");
          clearTimeout(timer);
          timer = setTimeout(sync, 800);
        }),
      );
    });
    persistLocal();
    if (hydrated && hasPending()) {
      clearTimeout(timer);
      timer = setTimeout(sync, 800);
    }
  };
  attachSections();
  const unsubscribeRegistry = subscribePreferenceRegistry(attachSections);
  const retry = () => {
    clearTimeout(timer);
    sync();
  };
  useAppPreferencesSync.setState({ retry });
  window.addEventListener("online", retry);
  sync();
  return () => {
    disposed = true;
    controller.abort();
    clearTimeout(timer);
    subscriptions.forEach((unsubscribe) => unsubscribe());
    unsubscribeRegistry();
    window.removeEventListener("online", retry);
  };
}
