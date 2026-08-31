import { useEffect, useRef, useState } from "react";

import { JellyfinItem } from "@/backend/jellyfin/client";
import {
  ContentItem,
  getContentPolicy,
  getPlaylistConfiguration,
  getPlaylistEditPermission,
  movePlaylistEntry,
  removeContentFromContainer,
  updatePlaylistDetails,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";

import {
  ContentCheckbox,
  ContentField,
  contentInputClass,
} from "./ContentMetadataEditor";

type ContainerEntry = JellyfinItem & {
  PlaylistItemId?: string;
  PlaylistIndex?: number;
};

export function ContentContainerManagement({
  item,
  entries,
  onChanged,
}: {
  item: ContentItem;
  entries: ContainerEntry[];
  onChanged: () => Promise<void>;
}) {
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState(item.Name);
  const [savedName, setSavedName] = useState(item.Name);
  const [isPublic, setIsPublic] = useState(false);
  const [savedPublic, setSavedPublic] = useState(false);
  const [configurationLoaded, setConfigurationLoaded] = useState(false);
  const [configurationError, setConfigurationError] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remove, setRemove] = useState<ContainerEntry | null>(null);
  const containerId = item.Id;
  const containerType = item.Type;

  useEffect(() => {
    setName(item.Name);
    setSavedName(item.Name);
  }, [item.Id, item.Name]);

  useEffect(() => {
    const controller = new AbortController();
    setCanManage(false);
    setRemove(null);
    setError("");
    setMessage("");
    setNeedsReload(false);
    setConfigurationLoaded(false);
    setConfigurationError(false);
    const check = async () => {
      if (containerType === "BoxSet") {
        const policy = await getContentPolicy(controller.signal);
        if (!controller.signal.aborted)
          setCanManage(
            policy.IsAdministrator === true ||
              policy.EnableCollectionManagement === true,
          );
        return;
      }
      const permission = await getPlaylistEditPermission(
        containerId,
        controller.signal,
      );
      if (controller.signal.aborted || !permission.CanEdit) return;
      setCanManage(true);
      let configuration;
      try {
        configuration = await getPlaylistConfiguration(
          containerId,
          controller.signal,
        );
      } catch {
        if (!controller.signal.aborted) setConfigurationError(true);
        return;
      }
      if (controller.signal.aborted) return;
      setIsPublic(configuration.OpenAccess);
      setSavedPublic(configuration.OpenAccess);
      setConfigurationLoaded(true);
    };
    // A public or read-only shared playlist has no edit permission. Treat a
    // denied lookup as read-only and leave the viewing controls available.
    check().catch(() => {
      if (!controller.signal.aborted) setCanManage(false);
    });
    return () => controller.abort();
  }, [containerId, containerType]);

  const change = async (operation: () => Promise<unknown>, success: string) => {
    if (busyRef.current || needsReload) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Jellyfin could not save the change.",
      );
      setBusy(false);
      busyRef.current = false;
      return;
    }
    setRemove(null);
    try {
      await onChanged();
      setMessage(success);
    } catch {
      setNeedsReload(true);
      setError(
        "The change was saved in Jellyfin, but this list could not be refreshed. Reload the latest items before making another change.",
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const retryReload = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await onChanged();
      setNeedsReload(false);
      setMessage("Latest items loaded.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not refresh this list. Reopen it to retry.",
      );
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const savePlaylist = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a playlist name.");
      return;
    }
    return change(async () => {
      await updatePlaylistDetails(item.Id, {
        ...(trimmed !== savedName ? { Name: trimmed } : {}),
        ...(isPublic !== savedPublic ? { IsPublic: isPublic } : {}),
      });
      setName(trimmed);
      setSavedName(trimmed);
      setSavedPublic(isPublic);
    }, "Playlist updated.");
  };

  const removeEntry = (entry: ContainerEntry) => {
    const entryId = item.Type === "Playlist" ? entry.PlaylistItemId : entry.Id;
    if (!entryId) return;
    return change(
      () =>
        removeContentFromContainer(
          item.Type as "BoxSet" | "Playlist",
          item.Id,
          entryId,
        ),
      `Removed from ${item.Type === "Playlist" ? "playlist" : "collection"}. The media remains in Jellyfin.`,
    );
  };

  const moveEntry = (entry: ContainerEntry, newIndex?: number) => {
    if (!entry.PlaylistItemId || newIndex === undefined) return;
    return change(
      () => movePlaylistEntry(item.Id, entry.PlaylistItemId!, newIndex),
      "Playlist order updated.",
    );
  };

  if (!canManage) return null;

  return (
    <details className="mt-5 rounded-xl border border-white/10 bg-background-secondary/40 p-4 md:p-5">
      <summary className="cursor-pointer text-sm font-medium text-white">
        Manage {item.Type === "Playlist" ? "playlist" : "collection"}
      </summary>
      <div className="space-y-5 pt-5">
        {item.Type === "Playlist" && configurationLoaded ? (
          <fieldset
            disabled={busy || needsReload}
            className="min-w-0 space-y-4 border-b border-white/10 pb-5"
          >
            <ContentField label="Playlist name">
              <input
                className={contentInputClass}
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
            </ContentField>
            <ContentCheckbox
              label="Public playlist"
              checked={isPublic}
              onChange={setIsPublic}
            />
            <p className="text-xs text-type-secondary">
              Public playlists can be viewed by other Jellyfin users. Saving
              these settings keeps the current shared users and items.
            </p>
            <Button
              theme="purple"
              loading={busy}
              disabled={
                !name.trim() ||
                (name.trim() === savedName && isPublic === savedPublic)
              }
              onClick={savePlaylist}
            >
              Save playlist
            </Button>
          </fieldset>
        ) : null}
        {configurationError ? (
          <p role="alert" className="text-sm text-red-400">
            Playlist settings could not be loaded. Item management is still
            available.
          </p>
        ) : null}
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-white">
            Items in this {item.Type === "Playlist" ? "playlist" : "collection"}
          </h5>
          {entries.map((entry, index) => {
            const key = entry.PlaylistItemId || `${entry.Id}-${index}`;
            const movable = item.Type === "Playlist" && !!entry.PlaylistItemId;
            return (
              <div
                key={key}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-background-secondary/50 p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {entry.Name}
                </span>
                {movable ? (
                  <div className="flex gap-2">
                    <Button
                      theme="secondary"
                      padding="px-3 py-2"
                      disabled={
                        busy ||
                        needsReload ||
                        index === 0 ||
                        entries[index - 1]?.PlaylistIndex === undefined
                      }
                      onClick={() =>
                        moveEntry(entry, entries[index - 1]?.PlaylistIndex)
                      }
                    >
                      Up
                    </Button>
                    <Button
                      theme="secondary"
                      padding="px-3 py-2"
                      disabled={
                        busy ||
                        needsReload ||
                        index === entries.length - 1 ||
                        entries[index + 1]?.PlaylistIndex === undefined
                      }
                      onClick={() =>
                        moveEntry(entry, entries[index + 1]?.PlaylistIndex)
                      }
                    >
                      Down
                    </Button>
                  </div>
                ) : null}
                <Button
                  theme="secondary"
                  padding="px-3 py-2"
                  disabled={
                    busy ||
                    needsReload ||
                    (item.Type === "Playlist" && !entry.PlaylistItemId)
                  }
                  onClick={() => setRemove(entry)}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          {!entries.length ? (
            <p className="text-sm text-type-secondary">
              No loaded items to manage.
            </p>
          ) : null}
        </div>
        {remove && !needsReload ? (
          <div
            role="alertdialog"
            aria-label="Remove item from container"
            className="space-y-3 rounded-lg border border-red-400/30 p-4"
          >
            <p className="text-sm text-white">
              Remove “{remove.Name}” from this{" "}
              {item.Type === "Playlist" ? "playlist" : "collection"}? The media
              file stays in Jellyfin.
            </p>
            <div className="flex gap-3">
              <Button
                theme="danger"
                loading={busy}
                onClick={() => removeEntry(remove)}
              >
                Remove item
              </Button>
              <Button
                theme="secondary"
                disabled={busy}
                onClick={() => setRemove(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {needsReload ? (
          <Button theme="secondary" loading={busy} onClick={retryReload}>
            Reload latest items
          </Button>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-type-link">
            {message}
          </p>
        ) : null}
      </div>
    </details>
  );
}
