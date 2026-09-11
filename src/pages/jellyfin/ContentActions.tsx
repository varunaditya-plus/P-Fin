import { useEffect, useRef, useState } from "react";

import {
  ContentItem,
  ContentPolicy,
  addContentToContainer,
  contentPermissions,
  contentStreamUrl,
  createContentContainer,
  deleteContent,
  getContentContainers,
  getContentPolicy,
  refreshContent,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";
import { Dropdown } from "@/components/form/Dropdown";
import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";

import { CollectionMembershipEditor } from "./CollectionMembershipEditor";
import {
  ContentImageEditor,
  ContentSubtitleEditor,
} from "./ContentAssetEditors";
import { ContentDownloadModal } from "./ContentDownloadModal";
import { ContentIdentifyEditor } from "./ContentIdentifyEditor";
import {
  ContentCheckbox,
  ContentField,
  ContentMetadataEditor,
  contentInputClass,
} from "./ContentMetadataEditor";

function ContainerEditor({
  item,
  type,
}: {
  item: ContentItem;
  type: "BoxSet" | "Playlist";
}) {
  const [containers, setContainers] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const label = type === "BoxSet" ? "collection" : "playlist";
  useEffect(() => {
    const controller = new AbortController();
    getContentContainers(type, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setContainers(items.filter((entry) => entry.Id !== item.Id));
          setSelected(items.find((entry) => entry.Id !== item.Id)?.Id ?? "");
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [item.Id, type]);
  const add = async (create: boolean) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (create) {
        const result = await createContentContainer(type, name, item.Id);
        setContainers((current) => [
          ...current,
          { Id: result.Id, Name: name.trim(), Type: type },
        ]);
        setSelected(result.Id);
        setName("");
      } else await addContentToContainer(type, selected, item.Id);
      setMessage(`Added to ${create ? `new ${label}` : label}.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `Could not update the ${label}.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <ContentField label={`Existing ${label}`}>
        <select
          className={contentInputClass}
          value={selected}
          disabled={loading || busy}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">{loading ? "Loading…" : `Select a ${label}`}</option>
          {containers.map((entry) => (
            <option key={entry.Id} value={entry.Id}>
              {entry.Name}
            </option>
          ))}
        </select>
      </ContentField>
      <Button
        theme="purple"
        loading={busy}
        disabled={!selected || loading}
        onClick={() => add(false)}
      >
        Add to {label}
      </Button>
      <div className="border-t border-white/10 pt-4 space-y-4">
        <ContentField label={`New ${label} name`}>
          <input
            className={contentInputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </ContentField>
        {type === "Playlist" ? (
          <p className="text-xs text-type-secondary">
            New playlists are private to your Jellyfin account.
          </p>
        ) : null}
        <Button
          theme="secondary"
          disabled={!name.trim()}
          loading={busy}
          onClick={() => add(true)}
        >
          Create {label} and add item
        </Button>
      </div>
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
  );
}
function RefreshEditor({ item }: { item: ContentItem }) {
  const [mode, setMode] = useState<"missing" | "replace" | "scan">("missing");
  const [images, setImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await refreshContent(item.Id, mode, images);
      setMessage(
        "Refresh queued in Jellyfin. Reopen the item after the server finishes to see updated metadata.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not refresh this item.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <ContentField label="Refresh mode">
        <select
          className={contentInputClass}
          value={mode}
          onChange={(event) => setMode(event.target.value as typeof mode)}
        >
          <option value="missing">Search for missing metadata</option>
          <option value="replace">Replace all metadata</option>
          <option value="scan">Scan for new and updated files</option>
        </select>
      </ContentField>
      {mode !== "scan" ? (
        <ContentCheckbox
          label="Replace existing images"
          checked={images}
          onChange={setImages}
        />
      ) : null}
      {mode === "replace" ? (
        <p className="text-sm text-type-secondary">
          This replaces existing metadata with information from your configured
          Jellyfin providers.
        </p>
      ) : null}
      <Button theme="purple" loading={busy} onClick={refresh}>
        Refresh metadata
      </Button>
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
  );
}
function DeleteEditor({
  item,
  onDeleted,
}: {
  item: ContentItem;
  onDeleted: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remove = async () => {
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      await deleteContent(item.Id);
      onDeleted();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete this item.",
      );
      setBusy(false);
    }
  };
  return (
    <div
      className="space-y-4"
      role="alertdialog"
      aria-label={`Delete ${item.Name}`}
    >
      <p className="text-sm text-white">
        {["BoxSet", "Playlist"].includes(item.Type)
          ? `Delete “${item.Name}”? The items in this ${item.Type === "BoxSet" ? "collection" : "playlist"} will remain in the library.`
          : `Permanently delete “${item.Name}” from Jellyfin and its media files from the server? This cannot be undone.`}
      </p>
      {item.Path ? (
        <p className="break-all text-xs text-type-secondary">{item.Path}</p>
      ) : null}
      <ContentCheckbox
        label="I understand and want to delete this item"
        checked={confirmed}
        onChange={setConfirmed}
      />
      <Button
        theme="danger"
        loading={busy}
        disabled={!confirmed}
        onClick={remove}
      >
        Delete permanently
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContentActions({
  item,
  sourceId,
  onSaved,
  onDeleted,
  initialAction,
  mode = "dropdown",
  hideDownload = false,
  playbackItem,
  onActionChange,
}: {
  item: ContentItem;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
  sourceId?: string;
  initialAction?: "collection" | "playlist";
  mode?: "dropdown" | "buttons";
  hideDownload?: boolean;
  playbackItem?: ContentItem | null;
  onActionChange?: (action: string) => void;
}) {
  const [policy, setPolicy] = useState<ContentPolicy | null>(null);
  const permissions = policy ? contentPermissions(item, policy) : null;
  const [policyError, setPolicyError] = useState("");
  const [action, setAction] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setAction("");
    setDownloadOpen(false);
    setPolicy(null);
    setPolicyError("");
    setCopyMessage("");
    getContentPolicy(controller.signal)
      .then((userPolicy) => {
        if (!controller.signal.aborted) setPolicy(userPolicy);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setPolicyError(reason.message);
      });
    return () => controller.abort();
  }, [item.Id]);
  useEffect(() => {
    onActionChange?.(action);
  }, [action, onActionChange]);
  useEffect(() => {
    if (action)
      panelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [action]);
  useEffect(() => {
    if (!initialAction || !policy) return;
    if (
      initialAction === "playlist" ||
      policy.IsAdministrator ||
      policy.EnableCollectionManagement
    )
      setAction(initialAction);
  }, [initialAction, item.Id, policy]);
  const streamItem = playbackItem === null ? undefined : (playbackItem ?? item);
  const copyStream = async () => {
    if (!streamItem) return;
    try {
      await navigator.clipboard.writeText(
        contentStreamUrl(streamItem, sourceId),
      );
      setCopyMessage(
        "Private stream URL copied. It includes your Jellyfin access token.",
      );
    } catch {
      setCopyMessage(
        "Clipboard access is unavailable. Use a secure browser connection.",
      );
    }
  };
  const options = [
    ...(permissions?.collections && !["BoxSet", "Playlist"].includes(item.Type)
      ? [{ id: "collection", name: "Add to collection" }]
      : []),
    ...(!["BoxSet", "Playlist", "Person"].includes(item.Type)
      ? [{ id: "playlist", name: "Add to playlist" }]
      : []),
    ...(permissions?.download && !hideDownload
      ? [{ id: "download", name: "Download file" }]
      : []),
    ...(streamItem?.MediaSources?.length
      ? [{ id: "stream", name: "Copy stream URL" }]
      : []),
    ...(permissions?.edit
      ? [
          { id: "metadata", name: "Edit metadata" },
          { id: "images", name: "Edit images" },
        ]
      : []),
    ...(permissions?.subtitles
      ? [{ id: "subtitles", name: "Edit subtitles" }]
      : []),
    ...(permissions?.edit &&
    ["Movie", "Trailer", "Series", "BoxSet", "Person", "MusicVideo"].includes(
      item.Type,
    )
      ? [{ id: "identify", name: "Identify" }]
      : []),
    ...(permissions?.edit ? [{ id: "refresh", name: "Refresh metadata" }] : []),
    ...(permissions?.delete ? [{ id: "delete", name: "Delete" }] : []),
  ];
  const chooseAction = (id: string) => {
    if (id === "download") setDownloadOpen(true);
    else if (id === "stream") copyStream();
    else setAction(id);
  };
  const actionIcons: Record<string, Icons> = {
    collection: Icons.BOOKMARK_OUTLINE,
    playlist: Icons.EPISODES,
    stream: Icons.LINK,
    metadata: Icons.EDIT,
    images: Icons.BRUSH,
    subtitles: Icons.CAPTIONS,
    identify: Icons.SEARCH,
    refresh: Icons.RELOAD,
    delete: Icons.X,
    download: Icons.DOWNLOAD,
  };
  return (
    <div className={mode === "buttons" ? "space-y-4" : "mt-4"}>
      <ContentDownloadModal
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        item={item}
        policy={policy}
        sourceId={sourceId}
      />
      {mode === "buttons" && !action ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-white">Content actions</h3>
          {!policy && !policyError ? (
            <div className="flex items-center gap-2 text-sm text-type-secondary">
              <Spinner className="text-sm" /> Loading actions
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseAction(option.id)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors bg-dropdown-background hover:bg-dropdown-hoverBackground tabbable ${option.id === "delete" ? "text-red-400" : "text-white"}`}
              >
                <Icon
                  icon={actionIcons[option.id]}
                  className="text-base opacity-70"
                />
                {option.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {mode === "dropdown" && options.length ? (
        <Dropdown
          options={options}
          selectedItem={{ id: "", name: "More actions" }}
          setSelectedItem={(option) => chooseAction(option.id)}
        />
      ) : null}
      {copyMessage ? (
        <p className="text-xs text-type-secondary" role="status">
          {copyMessage}
        </p>
      ) : null}
      {policyError ? (
        <p className="text-xs text-type-secondary" role="alert">
          Content management is unavailable: {policyError}
        </p>
      ) : null}
      {action ? (
        <div
          ref={panelRef}
          className={
            mode === "buttons"
              ? "space-y-5"
              : "rounded-xl bg-background-secondary/40 border border-white/10 p-4 md:p-5 my-5"
          }
        >
          <div className="flex items-center justify-between gap-4 mb-5">
            <h4 className="text-lg text-white font-semibold">
              {options.find((option) => option.id === action)?.name}
            </h4>
            <Button
              theme="secondary"
              padding="px-3 py-2"
              onClick={() => setAction("")}
            >
              {mode === "buttons" ? "Back" : "Close"}
            </Button>
          </div>
          {action === "metadata" && permissions?.edit ? (
            <ContentMetadataEditor
              key={item.Id}
              item={item}
              onSaved={onSaved}
            />
          ) : null}
          {action === "images" && permissions?.edit ? (
            <ContentImageEditor key={item.Id} item={item} onSaved={onSaved} />
          ) : null}
          {action === "subtitles" && permissions?.subtitles ? (
            <ContentSubtitleEditor
              key={item.Id}
              item={item}
              canDelete={permissions.edit}
              onSaved={onSaved}
            />
          ) : null}
          {action === "identify" && permissions?.edit ? (
            <ContentIdentifyEditor
              key={item.Id}
              item={item}
              onSaved={onSaved}
            />
          ) : null}
          {action === "refresh" && permissions?.edit ? (
            <RefreshEditor key={item.Id} item={item} />
          ) : null}
          {action === "delete" && permissions?.delete ? (
            <DeleteEditor key={item.Id} item={item} onDeleted={onDeleted} />
          ) : null}
          {action === "collection" && permissions?.collections ? (
            <CollectionMembershipEditor
              key={`collection-${item.Id}`}
              item={item}
              onSaved={onSaved}
            />
          ) : null}
          {action === "playlist" ? (
            <ContainerEditor
              key={`playlist-${item.Id}`}
              item={item}
              type="Playlist"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
