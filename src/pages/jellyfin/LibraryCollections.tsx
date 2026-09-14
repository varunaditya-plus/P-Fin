import { useEffect, useRef, useState } from "react";

import { getImageUrl } from "@/backend/jellyfin/client";
import {
  ContainerType,
  addUniqueContainerItems,
  createEmptyContainer,
  libraryDragType,
  parseLibraryDrop,
} from "@/backend/jellyfin/collections";
import {
  ContentItem,
  getContentContainers,
  getContentPolicy,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";

import { contentInputClass } from "./ContentMetadataEditor";

export function LibraryCollections({
  onOpen,
  onChanged,
}: {
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ContainerType>("BoxSet");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [hovered, setHovered] = useState("");
  const [revision, setRevision] = useState(0);
  const busyRef = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    if (!open) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setMessage("");
    setItems([]);
    setCanCreate(false);
    Promise.all([
      getContentContainers(type, controller.signal),
      getContentPolicy(controller.signal),
    ])
      .then(([containers, policy]) => {
        if (controller.signal.aborted) return;
        setItems(containers);
        setCanCreate(
          type === "Playlist" ||
            policy.IsAdministrator === true ||
            policy.EnableCollectionManagement === true,
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load collections.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      generation.current += 1;
    };
  }, [open, type, revision]);
  const mutate = async (action: () => Promise<string>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const current = generation.current;
    try {
      const result = await action();
      onChanged();
      if (current === generation.current) setMessage(result);
    } catch (reason) {
      if (current === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Jellyfin could not save this change.",
        );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="my-4">
      <Button theme="secondary" onClick={() => setOpen((value) => !value)}>
        {open ? "Close collections & playlists" : "Collections & playlists"}
      </Button>
      {open ? (
        <div className="mt-4 rounded-xl bg-background-secondary p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Collection type"
              className={contentInputClass}
              value={type}
              disabled={busy}
              onChange={(event) => {
                setType(event.target.value as ContainerType);
                setName("");
              }}
            >
              <option value="BoxSet">Collections</option>
              <option value="Playlist">Editable playlists</option>
            </select>
            {canCreate ? (
              <form
                className="flex flex-1 flex-wrap gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutate(async () => {
                    const result = await createEmptyContainer(type, name);
                    setItems((values) => [
                      ...values,
                      {
                        Id: result.Id,
                        Name: name.trim(),
                        Type: type,
                        ChildCount: 0,
                      },
                    ]);
                    setName("");
                    return `${type === "BoxSet" ? "Collection" : "Private playlist"} created.`;
                  });
                }}
              >
                <input
                  aria-label={`New ${type === "BoxSet" ? "collection" : "playlist"} name`}
                  placeholder={`New ${type === "BoxSet" ? "collection" : "playlist"} name`}
                  className={`${contentInputClass} min-w-0 flex-1`}
                  value={name}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
                <Button
                  type="submit"
                  theme="purple"
                  loading={busy}
                  disabled={!name.trim()}
                >
                  Create
                </Button>
              </form>
            ) : null}
          </div>
          {loading ? <p role="status">Loading…</p> : null}
          {canCreate ? (
            <p className="text-xs text-type-secondary">
              Drag a library title onto a collection or playlist to add it. You
              can also use a title’s actions menu.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item) => (
              <button
                type="button"
                key={item.Id}
                disabled={busy}
                onClick={() => onOpen(item.Id)}
                className={`tabbable min-w-0 overflow-hidden rounded-lg border text-left text-white transition-colors ${hovered === item.Id ? "border-type-link bg-white/10" : "border-white/10 bg-dropdown-background hover:border-type-link"}`}
                onDragOver={(event) => {
                  if (
                    !canCreate ||
                    busy ||
                    !event.dataTransfer.types.includes(libraryDragType)
                  )
                    return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setHovered(item.Id);
                }}
                onDragLeave={() => setHovered("")}
                onDrop={(event) => {
                  event.preventDefault();
                  setHovered("");
                  if (!canCreate || busy) return;
                  const ids = parseLibraryDrop(
                    event.dataTransfer.getData(libraryDragType),
                  );
                  if (ids.length)
                    mutate(async () => {
                      const added = await addUniqueContainerItems(
                        type,
                        item.Id,
                        ids,
                      );
                      if (added) setRevision((value) => value + 1);
                      return added
                        ? `Added ${added} ${added === 1 ? "title" : "titles"} to ${item.Name}.`
                        : `These titles are already in ${item.Name}.`;
                    });
                }}
              >
                <div className="relative flex aspect-video items-center justify-center bg-background-main text-3xl text-type-secondary">
                  <Icon icon={Icons.EPISODES} />
                  {getImageUrl(item, "Primary", 400) ? (
                    <img
                      src={getImageUrl(item, "Primary", 400)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 font-medium">{item.Name}</p>
                  <p className="text-xs text-type-secondary">
                    {item.ChildCount === undefined
                      ? type === "BoxSet"
                        ? "Collection"
                        : "Playlist"
                      : `${item.ChildCount} ${item.ChildCount === 1 ? "item" : "items"}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {!loading && !items.length ? (
            <p className="text-sm text-type-secondary">
              No {type === "BoxSet" ? "collections" : "editable playlists"} yet.
            </p>
          ) : null}
          {error ? (
            <div className="space-y-2">
              <p role="alert">{error}</p>
              <Button
                theme="secondary"
                disabled={busy}
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </div>
          ) : null}
          {message ? (
            <p role="status" className="text-type-link">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
