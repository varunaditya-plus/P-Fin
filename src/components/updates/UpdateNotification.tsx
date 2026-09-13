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
      enter="transition-[opacity,transform] duration-300 motion-reduce:transition-none"
      enterFrom="opacity-0 translate-y-3 motion-reduce:translate-y-0"
      enterTo="opacity-100 translate-y-0"
      leave="transition-opacity duration-200 motion-reduce:transition-none"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <section
        aria-label="App update"
        className="fixed z-[1900] bottom-4 right-4 left-4 sm:left-auto sm:w-96 rounded-2xl border border-white/10 bg-modal-background p-5 text-white shadow-2xl"
      >
        <button
          type="button"
          aria-label="Dismiss this update"
          disabled={applying}
          onClick={dismissAppUpdate}
          className="tabbable absolute top-3 right-3 rounded-full p-2 text-type-secondary hover:text-white disabled:opacity-50"
        >
          <Icon icon={Icons.X} />
        </button>
        <p role="status" className="font-semibold pr-8">
          An app update is available
        </p>
        <p className="mt-2 text-sm text-type-secondary">
          Refresh when you are ready. This restarts the page and stops playback.
        </p>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-type-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={applying}
          onClick={applyAppUpdate}
          className="tabbable mt-4 rounded-lg bg-buttons-purple px-4 py-2 font-medium hover:bg-buttons-purpleHover disabled:opacity-50"
        >
          {applying ? "Refreshing…" : "Refresh"}
        </button>
      </section>
    </Transition>
  );
}
