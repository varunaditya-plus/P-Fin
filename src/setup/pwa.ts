import { startAppUpdateMonitor } from "@/setup/appUpdates";

// The build's entry filename and optional service worker are the version signals.
// Activation and reloading are always initiated by this tab's Refresh button.
if (import.meta.env.PROD) {
  const stop = startAppUpdateMonitor({
    pwa: import.meta.env.VITE_PWA_ENABLED === "true",
  });
  if (import.meta.hot) import.meta.hot.dispose(stop);
}
