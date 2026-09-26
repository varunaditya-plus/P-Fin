import { Transition } from "@headlessui/react";
import { Fragment } from "react";
import { createPortal } from "react-dom";

import { applyAppUpdate, useAppUpdateStore } from "@/setup/appUpdates";

export function UpdateNotification() {
  const { available, dismissed, applying, error } = useAppUpdateStore();
  const show = Boolean(available && !dismissed.includes(available.version));
  // Detail dialogs make the app root inert. Keep this action in a separate
  // body-level portal so it stays reachable while a dialog is open.
  return createPortal(
    <Transition
      show={show}
      as={Fragment}
      enter="transition-opacity duration-150 motion-reduce:transition-none"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-150 motion-reduce:transition-none"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <section
        aria-label="App update"
        className="pointer-events-none fixed inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))] z-[1900] flex justify-center px-4"
      >
        <div className="pointer-events-auto max-w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-utils-divider bg-dropdown-background px-3 py-2.5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p role="status" className="text-sm font-medium leading-tight">
                Update available
              </p>
              <p className="mt-0.5 text-xs leading-snug text-type-secondary">
                Refreshing stops playback.
              </p>
            </div>
            <button
              type="button"
              disabled={applying}
              onClick={applyAppUpdate}
              className="tabbable shrink-0 rounded-lg bg-buttons-cancel px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-buttons-cancelHover disabled:opacity-50"
            >
              {applying ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-type-danger">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </Transition>,
    document.body,
  );
}
