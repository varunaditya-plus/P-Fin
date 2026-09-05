import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";

import { ContentItem } from "@/backend/jellyfin/content";
import { mediaSourceLabel } from "@/backend/jellyfin/mediaSourceLabel";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { useRetainedModalValue } from "@/components/overlays/DetailsModalFrame";

import { ContentActions } from "./ContentActions";
import {
  JellyfinTrackChoice,
  JellyfinTrackSelection,
} from "./JellyfinTrackSelection";

export interface ContentSettingsModalProps {
  open: boolean;
  onClose: () => void;
  item: ContentItem;
  playbackItem?: ContentItem | null;
  sourceId: string;
  onSourceChange: (sourceId: string) => void;
  tracks: JellyfinTrackChoice;
  onTracksChange: (tracks: JellyfinTrackChoice) => void;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
  initialAction?: "collection" | "playlist";
  onPlayFromBeginning?: () => void;
}

function ContentSettingsPanel({
  item,
  playbackItem,
  sourceId,
  onSourceChange,
  tracks,
  onTracksChange,
  onSaved,
  onDeleted,
  initialAction,
  onPlayFromBeginning,
}: Omit<ContentSettingsModalProps, "open" | "onClose">) {
  const [action, setAction] = useState("");
  // A series has no playable source of its own: its selected episode supplies
  // playback controls, while management actions still target the series.
  const playable =
    item.Type === "Series" ? playbackItem : (playbackItem ?? item);
  const sources = playable?.MediaSources ?? [];
  const source = sources.find((entry) => entry.Id === sourceId) ?? sources[0];
  return (
    <div className="space-y-6">
      {!action ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold text-white">Playback</h3>
            {item.Type === "Series" && playable ? (
              <p className="text-sm text-type-secondary mt-1">
                S{playable.ParentIndexNumber}:E{playable.IndexNumber} ·{" "}
                {playable.Name}
              </p>
            ) : null}
          </div>
          {source ? (
            <>
              <label className="block space-y-2 text-sm text-type-secondary">
                <span>Version</span>
                <select
                  className="block w-full truncate rounded-xl bg-dropdown-background py-3 pl-3 pr-8 text-white tabbable"
                  value={source.Id}
                  onChange={(event) => {
                    onSourceChange(event.target.value);
                    onTracksChange({});
                  }}
                >
                  {sources.map((entry) => (
                    <option key={entry.Id} value={entry.Id}>
                      {mediaSourceLabel(entry)}
                    </option>
                  ))}
                </select>
              </label>
              <JellyfinTrackSelection
                source={source}
                value={tracks}
                onChange={onTracksChange}
              />
            </>
          ) : (
            <p className="text-sm text-type-secondary">
              {item.Type === "Series"
                ? "Playback options will appear when a playable episode is available."
                : "No playback options are available for this item."}
            </p>
          )}
          {onPlayFromBeginning &&
          (playable?.UserData?.PlaybackPositionTicks ?? 0) > 0 ? (
            <Button
              theme="secondary"
              padding="px-4 py-2"
              onClick={onPlayFromBeginning}
            >
              <Icon icon={Icons.REPEAT} /> Play from beginning
            </Button>
          ) : null}
        </section>
      ) : null}
      <ContentActions
        item={item}
        sourceId={sourceId}
        playbackItem={playable ?? null}
        onSaved={onSaved}
        onDeleted={onDeleted}
        initialAction={initialAction}
        mode="buttons"
        hideDownload
        onActionChange={setAction}
      />
    </div>
  );
}

/** Render inside the detail Dialog so its focus trap is suspended while open. */
export function ContentSettingsModal(props: ContentSettingsModalProps) {
  const presence = useRetainedModalValue(props.open ? props.item : undefined);
  if (!presence.value) return null;
  return (
    <Transition
      appear
      show={props.open}
      as={Fragment}
      afterLeave={presence.afterLeave}
    >
      <Dialog
        as="div"
        className="relative z-[1100]"
        onClose={props.onClose}
        aria-label="Content settings"
      >
        <Transition.Child
          as={Fragment}
          enter="transition-opacity duration-200 motion-reduce:transition-none"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-200 motion-reduce:transition-none"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4 pt-safe pointer-events-none">
          <Transition.Child
            as={Fragment}
            enter="transition-[transform,opacity] duration-300 motion-reduce:transition-none"
            enterFrom="translate-y-4 opacity-0 motion-reduce:translate-y-0"
            enterTo="translate-y-0 opacity-100"
            leave="transition-[transform,opacity] duration-200 motion-reduce:transition-none"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-4 opacity-0 motion-reduce:translate-y-0"
          >
            <Dialog.Panel
              className="pointer-events-auto w-full max-w-2xl max-h-[85dvh] flex flex-col rounded-3xl bg-modal-background border border-white/10 shadow-2xl overflow-hidden"
              data-content-settings-panel
            >
              <div className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-white/10">
                <div className="min-w-0">
                  <Dialog.Title className="text-xl font-semibold text-white">
                    Settings
                  </Dialog.Title>
                  <p className="text-sm text-type-secondary mt-1 truncate">
                    {presence.value.Name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={props.onClose}
                  aria-label="Close settings"
                  className="rounded-full bg-pill-background p-3 text-type-secondary hover:text-white hover:bg-pill-backgroundHover transition-colors tabbable"
                >
                  <Icon icon={Icons.X} />
                </button>
              </div>
              <div className="overflow-y-auto overscroll-contain p-5 md:p-6 scrollbar-thin">
                <ContentSettingsPanel
                  key={presence.value.Id}
                  {...props}
                  item={presence.value}
                />
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
