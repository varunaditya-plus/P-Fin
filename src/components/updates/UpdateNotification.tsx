import { Transition } from "@headlessui/react";
import { Fragment } from "react";

import { Icon, Icons } from "@/components/Icon";
import {
  applyAppUpdate,
  dismissAppUpdate,
  useAppUpdateStore,
} from "@/setup/appUpdates";

export function UpdateNotification() {
  const { available, dismissed, applying, error } = useAppUpdateStore();
  const show = Boolean(available && !dismissed.includes(available.version));
  return (
    <Transition
      show={show}
      as={Fragment}
      enter="transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none"
      enterFrom="opacity-0 -translate-y-4 motion-reduce:translate-y-0"
      enterTo="opacity-100 translate-y-0"
      leave="transition-[opacity,transform] duration-200 motion-reduce:transition-none"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 -translate-y-4 motion-reduce:translate-y-0"
    >
      <section
        aria-label="App update"
        className="pointer-events-none fixed inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))] z-[1900] flex justify-center px-4"
      >
        <div className="pointer-events-auto relative max-w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#12141c]/85 px-4 py-3 pr-2 text-white shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_100%_at_0%_0%,rgba(139,92,246,0.18),transparent_70%)]"
          />
          <div className="relative flex items-center gap-3">
            <div
              aria-hidden="true"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] shadow-lg"
            >
              <span className="absolute inset-0 rounded-xl bg-[#8b5cf6]/40 motion-safe:animate-ping" />
              <Icon icon={Icons.RELOAD} className="relative text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p role="status" className="text-sm font-semibold leading-tight">
                An app update is available
              </p>
              <p className="mt-0.5 text-xs leading-snug text-white/60">
                Refresh when ready. This restarts the page and stops playback.
              </p>
            </div>
            <button
              type="button"
              disabled={applying}
              onClick={applyAppUpdate}
              className="tabbable shrink-0 rounded-lg bg-[#8b5cf6] px-3 py-1.5 text-xs font-bold text-white transition-[background-color,transform] duration-150 hover:bg-[#7c3aed] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 disabled:opacity-50"
            >
              {applying ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              aria-label="Dismiss this update"
              disabled={applying}
              onClick={dismissAppUpdate}
              className="tabbable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/5 hover:text-white/80 disabled:opacity-50"
            >
              <Icon icon={Icons.X} className="text-base" />
            </button>
          </div>
          {error ? (
            <p role="alert" className="relative mt-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </Transition>
  );
}
