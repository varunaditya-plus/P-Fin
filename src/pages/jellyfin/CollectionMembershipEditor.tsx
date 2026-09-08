import { useEffect, useRef, useState } from "react";

import {
  getCollectionMemberships,
  saveCollectionMemberships,
} from "@/backend/jellyfin/collections";
import {
  ContentItem,
  createContentContainer,
  getContentContainers,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";

import { ContentField, contentInputClass } from "./ContentMetadataEditor";

export function CollectionMembershipEditor({
  item,
  onSaved,
}: {
  item: ContentItem;
  onSaved: () => Promise<void>;
}) {
  const [collections, setCollections] = useState<ContentItem[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const busyRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setReady(false);
    setError("");
    getContentContainers("BoxSet", controller.signal)
      .then(async (values) => {
        const available = values.filter((entry) => entry.Id !== item.Id);
        const memberships = await getCollectionMemberships(
          item.Id,
          available,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setReady(true);
          setCollections(available);
          setSaved(memberships);
          setSelected(memberships);
        }
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
    return () => controller.abort();
  }, [item.Id, retry]);
  const change = async (create: boolean) => {
    if (busyRef.current || loading || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (create) {
        const result = await createContentContainer("BoxSet", name, item.Id);
        if (!alive.current) return;
        setCollections((values) => [
          ...values,
          { Id: result.Id, Name: name.trim(), Type: "BoxSet" },
        ]);
        setSaved((values) => [...values, result.Id]);
        setSelected((values) => [...values, result.Id]);
        setName("");
      } else {
        await saveCollectionMemberships(item.Id, saved, selected);
        if (!alive.current) return;
        setSaved([...selected]);
      }
      setMessage(
        create
          ? "Collection created and title added."
          : "Collection memberships saved.",
      );
      try {
        await onSaved();
      } catch {
        if (alive.current)
          setMessage(
            "Saved in Jellyfin. Reopen the library to refresh its counts.",
          );
      }
    } catch (reason) {
      if (!alive.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to update collections.",
      );
      // A multi-collection save can partially succeed. Reconcile before another write.
      if (!create) {
        setLoading(true);
        try {
          const memberships = await getCollectionMemberships(
            item.Id,
            collections,
          );
          if (alive.current) {
            setSaved(memberships);
            setSelected(memberships);
            setLoading(false);
          }
        } catch {
          if (alive.current)
            setError(
              "Some changes may have been saved. Reload the memberships before trying again.",
            );
        }
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const changed =
    saved.length !== selected.length ||
    saved.some((id) => !selected.includes(id));
  return (
    <div className="space-y-5">
      <p className="text-sm text-type-secondary">
        Choose every collection for this title. Clearing a collection removes
        only its membership.
      </p>
      {loading ? (
        <p role="status" className="text-sm">
          Loading memberships…
        </p>
      ) : null}
      <fieldset
        disabled={loading || busy || !ready}
        className="max-h-64 overflow-y-auto space-y-2"
      >
        {collections.map((collection) => (
          <label
            key={collection.Id}
            className="flex items-center gap-3 rounded-lg bg-dropdown-background p-3 text-white"
          >
            <input
              type="checkbox"
              checked={selected.includes(collection.Id)}
              onChange={(event) =>
                setSelected((values) =>
                  event.target.checked
                    ? [...values, collection.Id]
                    : values.filter((id) => id !== collection.Id),
                )
              }
            />
            {collection.Name}
          </label>
        ))}
        {!loading && !collections.length ? (
          <p className="text-sm">No collections yet.</p>
        ) : null}
      </fieldset>
      <Button
        theme="purple"
        loading={busy}
        disabled={!changed || loading || !ready}
        onClick={() => change(false)}
      >
        Save memberships
      </Button>
      <div className="border-t border-white/10 pt-4 space-y-4">
        <ContentField label="New collection name">
          <input
            className={contentInputClass}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </ContentField>
        <Button
          theme="secondary"
          loading={busy}
          disabled={!name.trim() || loading || !ready}
          onClick={() => change(true)}
        >
          Create collection and add item
        </Button>
      </div>
      {error ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
          <Button
            theme="secondary"
            disabled={busy}
            onClick={() => setRetry((value) => value + 1)}
          >
            Reload memberships
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-type-link">
          {message}
        </p>
      ) : null}
    </div>
  );
}
