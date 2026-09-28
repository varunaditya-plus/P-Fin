import { StateStorage } from "zustand/middleware";

/** Move existing tab-only logins without storing passwords or reviving a logout. */
export const persistentSessionStorage: StateStorage = {
  getItem(name) {
    const saved = localStorage.getItem(name);
    const previous = sessionStorage.getItem(name);
    if (saved === null && previous !== null)
      localStorage.setItem(name, previous);
    sessionStorage.removeItem(name);
    return saved ?? previous;
  },
  setItem(name, value) {
    localStorage.setItem(name, value);
    sessionStorage.removeItem(name);
  },
  removeItem(name) {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

export function syncSessionAcrossTabs(
  name: string,
  restore: () => void | Promise<void>,
  clear: () => void,
) {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key !== null && event.key !== name) return;
    if (localStorage.getItem(name) === null) clear();
    else restore();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
