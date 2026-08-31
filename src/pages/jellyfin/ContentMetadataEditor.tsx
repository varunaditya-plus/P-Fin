import { nanoid } from "nanoid";
import { ReactNode, useEffect, useRef, useState } from "react";

import {
  ContentItem,
  MetadataEditorInfo,
  getContentItem,
  getMetadataEditorInfo,
  updateContentMetadata,
} from "@/backend/jellyfin/content";
import { Button } from "@/components/buttons/Button";

export const contentInputClass =
  "w-full rounded-lg border border-white/10 bg-dropdown-background px-3 py-2 text-sm text-white focus:border-type-link focus:outline-none";
const seriesStatuses = ["Continuing", "Ended", "Unreleased"];
const listMetadataKeys = {
  genres: "Genres",
  tags: "Tags",
  studios: "Studios",
  countries: "ProductionLocations",
} as const;
function metadataLists(item: ContentItem) {
  return {
    genres: item.Genres?.join(", ") ?? "",
    tags: item.Tags?.join(", ") ?? "",
    studios: item.Studios?.map((studio) => studio.Name).join(", ") ?? "",
    countries: item.ProductionLocations?.join(", ") ?? "",
  };
}
export function ContentField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm text-type-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function ContentCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-white/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-purple-500 h-4 w-4"
      />
      {label}
    </label>
  );
}
export function ContentMetadataEditor({
  item,
  onSaved,
}: {
  item: ContentItem;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<ContentItem>(item);
  const [personKeys, setPersonKeys] = useState(
    () => item.People?.map(() => nanoid()) ?? [],
  );
  const [info, setInfo] = useState<MetadataEditorInfo>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const changedFields = useRef(new Set<keyof ContentItem>());
  const [listFields, setListFields] = useState(() => metadataLists(item));
  useEffect(() => {
    // Keep unsaved edits, but replace untouched fields with the current DTO.
    // A successful write clears changedFields before the parent reloads it.
    setDraft((current) => ({
      ...item,
      ...Object.fromEntries(
        [...changedFields.current].map((key) => [key, current[key]]),
      ),
    }));
    setListFields((current) => {
      const latest = metadataLists(item);
      return Object.fromEntries(
        Object.entries(latest).map(([key, value]) => [
          key,
          changedFields.current.has(
            listMetadataKeys[key as keyof typeof listMetadataKeys],
          )
            ? current[key as keyof typeof current]
            : value,
        ]),
      ) as typeof current;
    });
    if (!changedFields.current.has("People"))
      setPersonKeys(item.People?.map(() => nanoid()) ?? []);
  }, [item]);
  useEffect(() => {
    const controller = new AbortController();
    getMetadataEditorInfo(item.Id, controller.signal)
      .then(setInfo)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [item.Id]);
  const set = <K extends keyof ContentItem>(key: K, value: ContentItem[K]) => {
    changedFields.current.add(key);
    setMessage("");
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const text = (label: string, key: keyof ContentItem, type = "text") => (
    <ContentField label={label}>
      <input
        type={type}
        className={contentInputClass}
        value={String(draft[key] ?? "")}
        onChange={(event) => set(key, event.target.value)}
      />
    </ContentField>
  );
  const number = (label: string, key: keyof ContentItem, max?: number) => (
    <ContentField label={label}>
      <input
        type="number"
        min={0}
        max={max}
        step={key === "CommunityRating" ? "0.1" : "1"}
        className={contentInputClass}
        value={draft[key] === null ? "" : String(draft[key] ?? "")}
        onChange={(event) =>
          set(
            key,
            event.target.value === "" ? undefined : Number(event.target.value),
          )
        }
      />
    </ContentField>
  );
  const split = (value: string) => [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
  const save = async () => {
    if (busy || needsRefresh) return;
    if (!draft.Name.trim()) {
      setError("Enter a title.");
      return;
    }
    if (
      item.Type === "Series" &&
      draft.Status &&
      !seriesStatuses.includes(draft.Status)
    ) {
      setError("Choose a valid series status.");
      return;
    }
    if (
      (draft.CommunityRating !== undefined &&
        (draft.CommunityRating < 0 || draft.CommunityRating > 10)) ||
      (draft.CriticRating !== undefined &&
        (draft.CriticRating < 0 || draft.CriticRating > 100))
    ) {
      setError(
        "Community ratings must be between 0 and 10, and critic ratings between 0 and 100.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let saved = false;
    try {
      const edited: Partial<ContentItem> = Object.fromEntries(
        [...changedFields.current].map((key) => [key, draft[key]]),
      );
      if (changedFields.current.has("Name")) edited.Name = draft.Name.trim();
      if (changedFields.current.has("Genres"))
        edited.Genres = split(listFields.genres);
      if (changedFields.current.has("Tags"))
        edited.Tags = split(listFields.tags);
      if (changedFields.current.has("Studios"))
        edited.Studios = split(listFields.studios).map((Name) => ({ Name }));
      if (changedFields.current.has("ProductionLocations"))
        edited.ProductionLocations = split(listFields.countries);
      if (changedFields.current.has("People"))
        edited.People = draft.People?.filter((person) => person.Name.trim());
      const latest = await getContentItem(item.Id);
      await updateContentMetadata(latest, edited);
      saved = true;
      changedFields.current.clear();
      await onSaved();
      setMessage("Metadata saved.");
    } catch (reason) {
      if (saved) setNeedsRefresh(true);
      setError(
        saved
          ? "Metadata was saved, but the updated details could not be loaded. Reload the details before editing again."
          : reason instanceof Error
            ? reason.message
            : "Could not save metadata.",
      );
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      await onSaved();
      setNeedsRefresh(false);
      setMessage("Saved metadata reloaded.");
    } catch {
      setError(
        "The saved metadata could not be reloaded. Try again when Jellyfin is available.",
      );
    } finally {
      setBusy(false);
    }
  };
  const providerKeys = [
    ...new Set([
      ...Object.keys(item.ProviderIds ?? {}),
      ...(info.ExternalIdInfos?.map((entry) => entry.Key) ?? []),
    ]),
  ];
  return (
    <div className="space-y-5">
      <fieldset disabled={busy || needsRefresh} className="space-y-5 min-w-0">
        <div className="grid gap-4 md:grid-cols-2">
          {text("Title", "Name")}
          {text("Sort title", "ForcedSortName")}
          {text("Original title", "OriginalTitle")}
          {text("Original language", "OriginalLanguage")}
          <ContentField label="Tagline">
            <input
              className={contentInputClass}
              value={draft.Taglines?.[0] ?? ""}
              onChange={(event) =>
                set("Taglines", event.target.value ? [event.target.value] : [])
              }
            />
          </ContentField>
          {number("Production year", "ProductionYear")}
          {(["PremiereDate", "EndDate"] as const).map((key) => (
            <ContentField
              key={key}
              label={key === "PremiereDate" ? "Release date" : "End date"}
            >
              <input
                type="date"
                className={contentInputClass}
                value={draft[key]?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  set(
                    key,
                    event.target.value
                      ? `${event.target.value}T00:00:00.000Z`
                      : undefined,
                  )
                }
              />
            </ContentField>
          ))}
          {number("Community rating (0–10)", "CommunityRating", 10)}
          {number("Critic rating (0–100)", "CriticRating", 100)}
          <ContentField label="Parental rating">
            <input
              list={`ratings-${item.Id}`}
              className={contentInputClass}
              value={draft.OfficialRating ?? ""}
              onChange={(event) => set("OfficialRating", event.target.value)}
            />
            <datalist id={`ratings-${item.Id}`}>
              {info.ParentalRatingOptions?.map((rating) => (
                <option key={rating.Name} value={rating.Name} />
              ))}
            </datalist>
          </ContentField>
          {text("Custom parental rating", "CustomRating")}
          {item.Type === "Episode" || item.Type === "Season" ? (
            <>
              {number(
                item.Type === "Season" ? "Season number" : "Episode number",
                "IndexNumber",
              )}
              {item.Type === "Episode"
                ? number("Season number", "ParentIndexNumber")
                : null}
            </>
          ) : null}
          {item.Type === "Series" ? (
            <>
              <ContentField label="Status">
                <select
                  className={contentInputClass}
                  value={draft.Status ?? ""}
                  onChange={(event) =>
                    set("Status", event.target.value || undefined)
                  }
                >
                  <option value="">Unknown</option>
                  {seriesStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </ContentField>
              {text("Air time", "AirTime")}
            </>
          ) : null}
        </div>
        <ContentField label="Overview">
          <textarea
            className={`${contentInputClass} min-h-32`}
            rows={5}
            value={draft.Overview ?? ""}
            onChange={(event) => set("Overview", event.target.value)}
          />
        </ContentField>
        <div className="grid gap-4 md:grid-cols-2">
          {(["genres", "tags", "studios", "countries"] as const).map((key) => (
            <ContentField
              key={key}
              label={`${key[0].toUpperCase()}${key.slice(1)} (comma-separated)`}
            >
              <input
                className={contentInputClass}
                value={listFields[key]}
                onChange={(event) => {
                  changedFields.current.add(listMetadataKeys[key]);
                  setMessage("");
                  setListFields((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }));
                }}
              />
            </ContentField>
          ))}
        </div>
        <details className="border border-white/10 rounded-lg p-4">
          <summary className="cursor-pointer text-white font-medium">
            Cast & crew ({draft.People?.length ?? 0})
          </summary>
          <div className="space-y-3 mt-4">
            {draft.People?.map((person, index) => (
              <div
                key={personKeys[index]}
                className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_1fr_auto] gap-2"
              >
                <input
                  aria-label={`Person ${index + 1} name`}
                  className={contentInputClass}
                  value={person.Name}
                  onChange={(event) =>
                    set(
                      "People",
                      draft.People?.map((entry, i) =>
                        i === index
                          ? { ...entry, Name: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <select
                  aria-label={`Person ${index + 1} type`}
                  className={contentInputClass}
                  value={person.Type ?? "Actor"}
                  onChange={(event) =>
                    set(
                      "People",
                      draft.People?.map((entry, i) =>
                        i === index
                          ? { ...entry, Type: event.target.value }
                          : entry,
                      ),
                    )
                  }
                >
                  {[
                    ...new Set([
                      "Actor",
                      "Director",
                      "Writer",
                      "Producer",
                      "GuestStar",
                      "Composer",
                      "Creator",
                      "Editor",
                      person.Type ?? "Actor",
                    ]),
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <input
                  aria-label={`Person ${index + 1} role`}
                  placeholder="Role"
                  className={contentInputClass}
                  value={person.Role ?? ""}
                  onChange={(event) =>
                    set(
                      "People",
                      draft.People?.map((entry, i) =>
                        i === index
                          ? { ...entry, Role: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <Button
                  theme="secondary"
                  padding="px-3 py-2"
                  onClick={() => {
                    setPersonKeys((keys) => keys.filter((_, i) => i !== index));
                    set(
                      "People",
                      draft.People?.filter((_, i) => i !== index),
                    );
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              theme="secondary"
              onClick={() => {
                setPersonKeys((keys) => [...keys, nanoid()]);
                set("People", [
                  ...(draft.People ?? []),
                  {
                    Id: "00000000000000000000000000000000",
                    Name: "",
                    Type: "Actor",
                  },
                ]);
              }}
            >
              Add person
            </Button>
          </div>
        </details>
        <details className="border border-white/10 rounded-lg p-4">
          <summary className="cursor-pointer text-white font-medium">
            External IDs & metadata preferences
          </summary>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            {providerKeys.map((key) => (
              <ContentField
                key={key}
                label={
                  info.ExternalIdInfos?.find((entry) => entry.Key === key)
                    ?.Name || key
                }
              >
                <input
                  className={contentInputClass}
                  value={draft.ProviderIds?.[key] ?? ""}
                  onChange={(event) =>
                    set("ProviderIds", {
                      ...draft.ProviderIds,
                      [key]: event.target.value,
                    })
                  }
                />
              </ContentField>
            ))}
            <ContentField label="Preferred metadata language">
              <select
                className={contentInputClass}
                value={draft.PreferredMetadataLanguage ?? ""}
                onChange={(event) =>
                  set("PreferredMetadataLanguage", event.target.value)
                }
              >
                <option value="">Library default</option>
                {info.Cultures?.map((culture) => (
                  <option
                    key={culture.TwoLetterISOLanguageName}
                    value={culture.TwoLetterISOLanguageName}
                  >
                    {culture.DisplayName}
                  </option>
                ))}
              </select>
            </ContentField>
            <ContentField label="Preferred metadata country">
              <select
                className={contentInputClass}
                value={draft.PreferredMetadataCountryCode ?? ""}
                onChange={(event) =>
                  set("PreferredMetadataCountryCode", event.target.value)
                }
              >
                <option value="">Library default</option>
                {info.Countries?.map((country) => (
                  <option
                    key={country.TwoLetterISORegionName}
                    value={country.TwoLetterISORegionName}
                  >
                    {country.Name}
                  </option>
                ))}
              </select>
            </ContentField>
          </div>
        </details>
        <ContentCheckbox
          label="Lock this item's metadata against automatic changes"
          checked={draft.LockData ?? false}
          onChange={(value) => set("LockData", value)}
        />
        {item.Type === "Series" || item.Type === "Season" ? (
          <p className="text-xs text-type-secondary">
            Jellyfin also applies changes to parental ratings, tags and metadata
            locks to child items.
          </p>
        ) : null}
      </fieldset>
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
      <Button
        theme="purple"
        loading={busy}
        onClick={needsRefresh ? reload : save}
      >
        {needsRefresh ? "Reload saved metadata" : "Save metadata"}
      </Button>
    </div>
  );
}
