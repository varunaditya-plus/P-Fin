import { useState } from "react";

import {
  ContentItem,
  ContentSearchResult,
  applyContentIdentity,
  safeExternalUrl,
  searchContentIdentity,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";

import {
  ContentCheckbox,
  ContentField,
  contentInputClass,
} from "./ContentMetadataEditor";

export function ContentIdentifyEditor({
  item,
  onSaved,
}: {
  item: ContentItem;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(item.Name);
  const [year, setYear] = useState(item.ProductionYear?.toString() ?? "");
  const [tmdb, setTmdb] = useState("");
  const [imdb, setImdb] = useState("");
  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [selected, setSelected] = useState<ContentSearchResult | null>(null);
  const [replaceImages, setReplaceImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const search = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setSelected(null);
    setResults([]);
    setSearched(false);
    try {
      setResults(
        await searchContentIdentity(
          item,
          name,
          year ? Number(year) : undefined,
          { ...(tmdb ? { Tmdb: tmdb } : {}), ...(imdb ? { Imdb: imdb } : {}) },
        ),
      );
      setSearched(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not search for this item.",
      );
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    let applied = false;
    try {
      await applyContentIdentity(item.Id, selected, replaceImages);
      applied = true;
      setSelected(null);
      setResults([]);
      setSearched(false);
      await onSaved();
      setMessage("Identity and metadata updated.");
    } catch (reason) {
      setError(
        applied
          ? "Identity and metadata were updated, but the details could not be reloaded. Close and reopen this item to see the changes."
          : reason instanceof Error
            ? reason.message
            : "Could not identify this item.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
        <ContentField label="Title">
          <input
            className={contentInputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </ContentField>
        <ContentField label="Year">
          <input
            type="number"
            min={0}
            className={contentInputClass}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </ContentField>
        <ContentField label="TMDB ID">
          <input
            className={contentInputClass}
            value={tmdb}
            onChange={(event) => setTmdb(event.target.value)}
          />
        </ContentField>
        <ContentField label="IMDb ID">
          <input
            className={contentInputClass}
            value={imdb}
            onChange={(event) => setImdb(event.target.value)}
          />
        </ContentField>
      </fieldset>
      <Button
        theme="purple"
        loading={busy}
        disabled={!name.trim() && !tmdb && !imdb}
        onClick={search}
      >
        Search
      </Button>
      {selected ? (
        <div className="border border-white/10 rounded-lg p-4 space-y-4">
          <h5 className="text-white font-medium">
            Use {selected.Name}
            {selected.ProductionYear ? ` (${selected.ProductionYear})` : ""}?
          </h5>
          <p className="text-sm text-type-secondary">
            This replaces the item&apos;s identity and metadata with the
            selected match.
          </p>
          <ContentCheckbox
            label="Replace existing images"
            checked={replaceImages}
            onChange={setReplaceImages}
          />
          <div className="flex gap-3">
            <Button theme="purple" loading={busy} onClick={apply}>
              Apply identification
            </Button>
            <Button
              theme="secondary"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((result) => (
          <button
            type="button"
            key={`${result.SearchProviderName}-${JSON.stringify(result.ProviderIds)}`}
            disabled={busy}
            onClick={() => setSelected(result)}
            className={`text-left flex gap-3 rounded-lg p-3 bg-background-secondary/50 border ${selected === result ? "border-type-link" : "border-transparent"}`}
          >
            {safeExternalUrl(result.ImageUrl) ? (
              <img
                src={result.ImageUrl}
                alt=""
                className="w-16 h-24 object-cover rounded"
                loading="lazy"
              />
            ) : null}
            <div>
              <p className="text-sm text-white">
                {result.Name}{" "}
                {result.ProductionYear ? `(${result.ProductionYear})` : ""}
              </p>
              <p className="text-xs text-type-secondary mt-1">
                {result.SearchProviderName}
              </p>
              <p className="text-xs text-type-secondary mt-2 line-clamp-3">
                {result.Overview?.replace(/<[^>]*>/g, "")}
              </p>
            </div>
          </button>
        ))}
      </div>
      {searched && !results.length ? (
        <p className="text-sm text-type-secondary">
          No matches were returned by Jellyfin&apos;s metadata providers.
        </p>
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
  );
}
