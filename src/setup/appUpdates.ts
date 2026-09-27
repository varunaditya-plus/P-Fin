import { create } from "zustand";

const dismissedKey = "movie-fin-dismissed-updates";
function readDismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(dismissedKey) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter((entry): entry is string => typeof entry === "string")
          .slice(-20)
      : [];
  } catch {
    return [];
  }
}
export const useAppUpdateStore = create<{
  available?: { version: string; apply: () => Promise<void> };
  dismissed: string[];
  applying: boolean;
  error?: string;
}>(() => ({ dismissed: readDismissed(), applying: false }));

export function offerAppUpdate(version: string, apply: () => Promise<void>) {
  useAppUpdateStore.setState({ available: { version, apply } });
}
export function dismissAppUpdate() {
  const state = useAppUpdateStore.getState();
  if (!state.available || state.applying) return;
  const dismissed = [
    ...state.dismissed.filter((entry) => entry !== state.available!.version),
    state.available.version,
  ].slice(-20);
  useAppUpdateStore.setState({ dismissed, error: undefined });
  try {
    localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
  } catch {
    /* Private mode can deny storage. */
  }
}
export async function applyAppUpdate() {
  const state = useAppUpdateStore.getState();
  if (!state.available || state.applying) return;
  useAppUpdateStore.setState({ applying: true, error: undefined });
  try {
    await state.available.apply();
    useAppUpdateStore.setState({ applying: false });
  } catch (error) {
    useAppUpdateStore.setState({
      applying: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not refresh. Try again when you are online.",
    });
  }
}

/** Existing production entry filenames already identify the deployed build. */
export function buildVersion(
  document: Document,
  base: string,
): string | undefined {
  const origin = new URL(base).origin;
  const entries = [
    ...document.querySelectorAll<HTMLScriptElement>(
      'script[type="module"][src]',
    ),
  ]
    .map((script) => script.getAttribute("src"))
    .filter((value): value is string => Boolean(value))
    .map((value) => new URL(value, base))
    .filter(
      (url) =>
        url.origin === origin && /\/assets\/[^/]+\.js$/.test(url.pathname),
    )
    .map((url) => url.pathname + url.search)
    .sort();
  return entries.length ? entries.join("|") : undefined;
}
function fingerprint(text: string) {
  // An identifier only; this is not used for authentication or integrity checks.
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 4294967296;
  }
  return hash.toString(16);
}

async function fetchFreshText(url: string, signal: AbortSignal) {
  const fresh = new URL(url, window.location.origin);
  fresh.searchParams.set("__pfin_update_check", String(Date.now()));
  const response = await fetch(fresh, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Could not check the current app version.");
  return response.text();
}

export async function activateWaitingWorker(
  registration: ServiceWorkerRegistration,
) {
  const worker = registration.waiting;
  if (!worker) return;
  await new Promise<void>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    let onChange: () => void;
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", onChange);
      if (error) reject(error);
      else resolve();
    };
    onChange = () => {
      if (worker.state === "activated") finish();
      else if (worker.state === "redundant")
        finish(new Error("The update was replaced. Try Refresh again."));
    };
    timeout = setTimeout(
      () =>
        finish(new Error("The update is still preparing. Try Refresh again.")),
      15000,
    );
    worker.addEventListener("statechange", onChange);
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
      onChange();
    } catch {
      finish(new Error("Could not activate the update. Try Refresh again."));
    }
  });
}

/** Polls the current site only. A deployed build can never trigger a reload itself. */
export function startAppUpdateMonitor({
  baseUrl = new URL(
    import.meta.env.BASE_URL,
    window.location.origin,
  ).toString(),
  pwa = false,
  reload = () => window.location.reload(),
}: { baseUrl?: string; pwa?: boolean; reload?: () => void } = {}) {
  const baseline = buildVersion(document, baseUrl);
  const indexUrl = new URL("index.html", baseUrl).toString();
  const swUrl = new URL("sw.js", baseUrl).toString();
  let registration: ServiceWorkerRegistration | undefined;
  let stopped = false;
  let inFlight: AbortController | undefined;
  const listeners: (() => void)[] = [];
  let check: () => Promise<void>;
  const apply = async () => {
    if (!navigator.onLine)
      throw new Error("You are offline. Refresh when you are connected again.");
    if (registration?.installing)
      throw new Error(
        "The update is still downloading. Try Refresh again in a moment.",
      );
    if (registration?.waiting) await activateWaitingWorker(registration);
    reload();
  };
  const inspectWorker = () => {
    if (registration?.waiting) check().catch(() => {});
  };
  const watchInstalling = () => {
    const worker = registration?.installing;
    if (!worker) return;
    const change = () => {
      if (worker.state === "installed") inspectWorker();
    };
    worker.addEventListener("statechange", change);
    listeners.push(() => worker.removeEventListener("statechange", change));
  };
  check = async () => {
    if (
      stopped ||
      inFlight ||
      !navigator.onLine ||
      document.visibilityState === "hidden"
    )
      return;
    const controller = new AbortController();
    inFlight = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const html = await fetchFreshText(indexUrl, controller.signal);
      if (stopped) return;
      const latest = buildVersion(
        new DOMParser().parseFromString(html, "text/html"),
        baseUrl,
      );
      if (baseline && latest && latest !== baseline)
        offerAppUpdate(`build:${latest}`, apply);
      // The service worker can change without a new entry bundle (for example,
      // cache policy). Use that existing script as the fallback version signal.
      else if (registration?.waiting) {
        const script = await fetchFreshText(swUrl, controller.signal);
        if (!stopped) offerAppUpdate(`sw:${fingerprint(script)}`, apply);
      }
      if (registration && !registration.installing)
        registration.update().catch(() => {});
    } catch {
      // Failed background checks never interrupt playback or replace a working page.
    } finally {
      clearTimeout(timeout);
      if (inFlight === controller) inFlight = undefined;
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") check().catch(() => {});
  };
  const onOnline = () => {
    check().catch(() => {});
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  const interval = setInterval(
    () => {
      check().catch(() => {});
    },
    10 * 60 * 1000,
  );
  if (pwa && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(swUrl, { scope: baseUrl, updateViaCache: "none" })
      .then((value) => {
        if (stopped) return;
        registration = value;
        value.addEventListener("updatefound", watchInstalling);
        listeners.push(() =>
          value.removeEventListener("updatefound", watchInstalling),
        );
        watchInstalling();
        inspectWorker();
      })
      .catch(() => {});
  }
  check().catch(() => {});
  return () => {
    stopped = true;
    clearInterval(interval);
    inFlight?.abort();
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
    listeners.forEach((remove) => remove());
  };
}
