import { useEffect, useRef, useState } from "react";

import {
  ImportRow,
  applyLetterboxd,
  parseLetterboxdCsv,
  previewLetterboxd,
  watchlistCsv,
} from "@/backend/integrations/letterboxd";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { SettingsCard } from "@/components/layout/SettingsCard";
import { Heading1 } from "@/components/utils/Text";
import { SettingsFilePicker } from "@/pages/jellyfin/settings/SettingsFilePicker";
import { useIntegrationWatchlist } from "@/stores/integrations/watchlist";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { homePreferenceScope } from "@/stores/jellyfin/home";
import { matchesSeerrSession, useSeerrConnection } from "@/stores/seerr";

function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LetterboxdSettings() {
  const session = useJellyfinAuth((state) => state.session);
  const scope = homePreferenceScope(session);
  const connection = useSeerrConnection((state) => state.connection);
  const watchlist = useIntegrationWatchlist((state) => state.profiles[scope]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mode, setMode] = useState<"watchlist" | "watched">("watchlist");
  const [lookupSeerr, setLookupSeerr] = useState(false);
  const [file, setFile] = useState<File>();
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [phase, setPhase] = useState<
    "idle" | "matching" | "ready" | "importing" | "done"
  >("idle");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<{ title: string; error: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [limit, setLimit] = useState(50);
  const controller = useRef<AbortController>();
  useEffect(() => {
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setPhase("idle");
    setStatus("");
    setError("");
    setFailures([]);
    setReviewed(false);
    setBusy(false);
    return () => controller.current?.abort();
  }, [scope, session?.accessToken]);

  const preview = async () => {
    if (!file || busy) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setReviewed(false);
    setRows([]);
    setError("");
    setFailures([]);
    setLimit(50);
    setPhase("matching");
    setProgress({ done: 0, total: 0 });
    try {
      const parsed = parseLetterboxdCsv(await file.text());
      run.signal.throwIfAborted();
      setProgress({ done: 0, total: parsed.titles.length });
      setStatus(
        `${parsed.titles.length} films; ${parsed.duplicates} duplicate rows and ${parsed.invalid} invalid rows skipped. Loading your library…`,
      );
      await previewLetterboxd(parsed.titles, {
        seerr: lookupSeerr,
        signal: run.signal,
        progress: (next) => {
          if (run.signal.aborted) return;
          setRows(next);
          setProgress({ done: next.length, total: parsed.titles.length });
          setStatus(
            `Matched ${next.length} of ${parsed.titles.length}. ${parsed.duplicates} duplicate rows and ${parsed.invalid} invalid rows skipped.`,
          );
        },
      });
      if (!run.signal.aborted) {
        setReviewed(true);
        setPhase("ready");
      }
    } catch (reason) {
      if (!run.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to preview this CSV.",
        );
    } finally {
      if (!run.signal.aborted) setBusy(false);
    }
  };
  const apply = async () => {
    if (busy || !reviewed) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setError("");
    setFailures([]);
    setPhase("importing");
    setProgress({ done: 0, total: rows.length });
    try {
      const result = await applyLetterboxd(rows, mode, run.signal, (count) => {
        if (!run.signal.aborted) {
          setStatus(`Imported ${count} of ${rows.length} rows…`);
          setProgress({ done: count, total: rows.length });
        }
      });
      if (run.signal.aborted) return;
      setStatus(
        `${result.added} ${mode === "watched" ? "marked watched" : "added to your watchlist"}; ${result.skipped} unmatched or existing entries skipped; ${result.failures.length} failed.`,
      );
      setFailures(result.failures);
      setPhase("done");
    } catch (reason) {
      if (!run.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : "Import interrupted.",
        );
    } finally {
      if (!run.signal.aborted) setBusy(false);
    }
  };
  const visible = (
    showUnmatched ? rows.filter((row) => !row.selected) : rows
  ).slice(0, limit);
  const selected = rows.filter(
    (row) => row.selected && (mode === "watchlist" || row.selected.jellyfinId),
  ).length;
  return (
    <>
      <section className="space-y-4">
        <Heading1 border>Letterboxd</Heading1>
        <p>
          Export your data from{" "}
          <a
            href="https://letterboxd.com/settings/data/"
            target="_blank"
            rel="noreferrer"
            className="text-white underline"
          >
            Letterboxd settings
          </a>
          , extract the ZIP, then choose watchlist.csv or watched.csv. Reviews,
          ratings and diary dates are not imported.
        </p>
        <SettingsCard
          className="space-y-4"
          paddingClass="px-5 py-5 sm:px-8 sm:py-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-white">Import your films</p>
              <p className="mt-1 text-sm text-type-secondary">
                Select a Letterboxd CSV, review the matches, then import.
              </p>
            </div>
            <SettingsFilePicker
              label="Letterboxd CSV file"
              accept=".csv,text/csv"
              fileName={file?.name}
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setRows([]);
                setReviewed(false);
                setStatus("");
                setError("");
                setProgress({ done: 0, total: 0 });
                setPhase("idle");
              }}
            />
          </div>
          <label className="block">
            Import as
            <select
              className="ml-3 rounded-lg bg-background-secondary p-3 text-white tabbable"
              value={mode}
              disabled={busy}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="watchlist">Watchlist</option>
              <option value="watched">Watched films in Jellyfin</option>
            </select>
          </label>
          <p className="text-sm">
            Watchlist entries are saved for this Jellyfin account. Marking
            watched updates only matched films you can access in Jellyfin.
          </p>
          {matchesSeerrSession(connection, session) ? (
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={lookupSeerr}
                disabled={busy}
                onChange={(event) => setLookupSeerr(event.target.checked)}
              />
              Look up unavailable films through Seerr (one search per unmatched
              film)
            </label>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              theme="secondary"
              disabled={!file || busy}
              onClick={preview}
            >
              Preview matches
            </Button>
            {busy ? (
              <Button
                theme="secondary"
                onClick={() => {
                  controller.current?.abort();
                  setBusy(false);
                  setReviewed(false);
                  setPhase("idle");
                  setStatus(
                    "Stopped. Completed changes are retained; importing again skips existing entries.",
                  );
                }}
              >
                Stop
              </Button>
            ) : null}
          </div>
          {file ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
              {[
                { label: "Letterboxd", value: file.name },
                { label: "Parsed", value: progress.total },
                {
                  label: "Status",
                  value: error
                    ? "Error"
                    : phase === "idle"
                      ? "Ready to preview"
                      : phase[0].toUpperCase() + phase.slice(1),
                },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="min-w-0 rounded-2xl border border-settings-card-border/60 bg-black/20 px-4 py-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-type-secondary/80">
                    {entry.label}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {entry.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {busy && progress.total > 0 ? (
            <div className="rounded-2xl border border-settings-card-border/60 bg-black/20 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-white">
                  {phase === "importing" ? "Importing" : "Matching films"}
                </span>
                <span>
                  {progress.done} of {progress.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={
                  phase === "importing" ? "Importing films" : "Matching films"
                }
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                className="h-2 w-full overflow-hidden rounded-full bg-background-secondary"
              >
                <div
                  className="h-full bg-buttons-purple transition-[width] duration-200 motion-reduce:transition-none"
                  style={{
                    width: `${Math.min(100, (progress.done / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </SettingsCard>
        {status ? (
          <p
            role="status"
            className={
              phase === "done"
                ? "flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400"
                : "text-sm text-type-secondary"
            }
          >
            {phase === "done" ? <Icon icon={Icons.CHECKMARK} /> : null}
            {status}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-type-danger"
          >
            {error}
          </p>
        ) : null}
        {rows.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {selected} selected;{" "}
                {rows.filter((row) => !row.selected).length} need review
              </span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showUnmatched}
                  onChange={(event) => {
                    setShowUnmatched(event.target.checked);
                    setLimit(50);
                  }}
                />
                Only unmatched
              </label>
            </div>
            <div className="space-y-2">
              {visible.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-lg bg-dropdown-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-bold text-white">
                      {row.title} ({row.year})
                    </p>
                    {row.error ? <p className="text-sm">{row.error}</p> : null}
                    {!row.candidates.length ? (
                      <p className="text-sm">
                        No exact title and year match. This row will be skipped.
                      </p>
                    ) : null}
                    {row.sourceUrl ? (
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline"
                      >
                        View on Letterboxd
                      </a>
                    ) : null}
                  </div>
                  {row.candidates.length ? (
                    <select
                      aria-label={`Match for ${row.title}`}
                      disabled={busy}
                      value={
                        row.selected ? row.candidates.indexOf(row.selected) : -1
                      }
                      className="max-w-full rounded-lg bg-background-secondary p-3 text-white tabbable"
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  selected:
                                    item.candidates[Number(event.target.value)],
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value={-1}>Skip this film</option>
                      {row.candidates.map((candidate, index) => (
                        <option
                          key={candidate.jellyfinId ?? candidate.tmdbId}
                          value={index}
                        >
                          {candidate.title} ({candidate.year}) ·{" "}
                          {candidate.jellyfinId
                            ? `Jellyfin${candidate.played ? " · watched" : ""}`
                            : "Seerr · unavailable"}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
            {visible.length <
            (showUnmatched ? rows.filter((row) => !row.selected) : rows)
              .length ? (
              <Button
                theme="secondary"
                onClick={() => setLimit((current) => current + 50)}
              >
                Show more rows
              </Button>
            ) : null}
            <Button
              theme="purple"
              disabled={busy || !reviewed || !selected}
              onClick={apply}
            >
              {mode === "watched"
                ? `Mark ${selected} matched films watched`
                : `Import ${selected} selected films to watchlist`}
            </Button>
          </>
        ) : null}
        {failures.length ? (
          <details open>
            <summary>Failed entries</summary>
            {failures.map((failure) => (
              <p key={`${failure.title}:${failure.error}`}>
                {failure.title}: {failure.error}
              </p>
            ))}
          </details>
        ) : null}
      </section>
      <section className="space-y-4">
        <Heading1 border>Your watchlist</Heading1>
        <p>
          {watchlist?.length ?? 0} entries for {session?.userName}. This list is
          separate from Jellyfin favourites and never requests content
          automatically.
        </p>
        <Button
          theme="secondary"
          disabled={!watchlist?.length}
          onClick={() =>
            downloadCsv(
              watchlistCsv(watchlist ?? []),
              "movie-fin-watchlist.csv",
            )
          }
        >
          Export watchlist CSV
        </Button>
        <div className="space-y-2">
          {(watchlist ?? []).slice(0, limit).map((entry) => (
            <div
              key={entry.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-dropdown-background p-4"
            >
              <div>
                <p className="font-bold text-white">
                  {entry.title} {entry.year ? `(${entry.year})` : ""}
                </p>
                <p className="text-sm">
                  {entry.type === "tv" ? "Series" : "Film"}
                </p>
              </div>
              <div className="flex gap-2">
                {entry.jellyfinId ? (
                  <Button
                    theme="secondary"
                    href={`/?item=${encodeURIComponent(entry.jellyfinId)}`}
                  >
                    Details
                  </Button>
                ) : entry.tmdbId && matchesSeerrSession(connection, session) ? (
                  <Button
                    theme="secondary"
                    href={`/discover?media=${entry.tmdbId}&type=${entry.type}`}
                  >
                    Details
                  </Button>
                ) : null}
                <Button
                  theme="secondary"
                  onClick={() =>
                    useIntegrationWatchlist.getState().remove(scope, entry.key)
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        {(watchlist?.length ?? 0) > limit ? (
          <Button
            theme="secondary"
            onClick={() => setLimit((current) => current + 50)}
          >
            Show more entries
          </Button>
        ) : null}
      </section>
    </>
  );
}
