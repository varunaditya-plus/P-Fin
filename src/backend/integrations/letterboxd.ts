import {
  JellyfinItem,
  getJellyfinSession,
  jellyfinRequest,
} from "@/backend/jellyfin/client";
import { getSeerrPage } from "@/backend/seerr/api";
import {
  WatchlistEntry,
  useIntegrationWatchlist,
  validateWatchlist,
} from "@/stores/integrations/watchlist";

import {
  integrationIdentity,
  integrationLibrary,
  providerId,
  requireIntegrationIdentity,
} from "./library";

export interface ImportTitle {
  title: string;
  year?: number;
  sourceUrl?: string;
}
export interface ImportCandidate {
  title: string;
  year?: number;
  jellyfinId?: string;
  tmdbId?: number;
  imdbId?: string;
  played?: boolean;
}
export interface ImportRow extends ImportTitle {
  id: number;
  candidates: ImportCandidate[];
  selected?: ImportCandidate;
  error?: string;
}
export const normaliseImportTitle = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

export function parseLetterboxdCsv(source: string) {
  if (source.length > 5 * 1024 * 1024)
    throw new Error("Choose a CSV smaller than 5 MB.");
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  const input = source.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (quoted || !cell) quoted = !quoted;
      else
        throw new Error(
          "Invalid quote in CSV. Use the original Letterboxd export.",
        );
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      record.push(cell);
      cell = "";
      if (char !== ",") {
        if (record.some(Boolean)) records.push(record);
        record = [];
        if (char === "\r" && input[index + 1] === "\n") index += 1;
      }
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  record.push(cell);
  if (record.some(Boolean)) records.push(record);
  const headers =
    records.shift()?.map((header) => header.trim().toLowerCase()) ?? [];
  const nameIndex = headers.indexOf("name");
  const yearIndex = headers.indexOf("year");
  if (nameIndex < 0 || yearIndex < 0)
    throw new Error(
      "Choose a Letterboxd CSV with Name and Year columns, such as watchlist.csv or watched.csv.",
    );
  if (records.length > 10000)
    throw new Error("Import up to 10,000 films at a time.");
  const uriIndex = headers.indexOf("letterboxd uri");
  const titles: ImportTitle[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let invalid = 0;
  records.forEach((row) => {
    const title = row[nameIndex]?.trim();
    const year = Number(row[yearIndex]);
    if (!title || !Number.isInteger(year) || year < 1800 || year > 2200) {
      invalid += 1;
      return;
    }
    const key = `${normaliseImportTitle(title)}:${year}`;
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    const uri = row[uriIndex];
    titles.push({
      title,
      year,
      sourceUrl:
        uri && /^https:\/\/letterboxd\.com\//i.test(uri) ? uri : undefined,
    });
  });
  return { titles, duplicates, invalid, total: records.length };
}

export function matchLibraryTitle(
  title: ImportTitle,
  library: JellyfinItem[],
): ImportCandidate[] {
  return library
    .filter(
      (item) =>
        item.Type === "Movie" &&
        normaliseImportTitle(item.Name) === normaliseImportTitle(title.title) &&
        (!title.year || item.ProductionYear === title.year),
    )
    .map((item) => ({
      title: item.Name,
      year: item.ProductionYear,
      jellyfinId: item.Id,
      played: item.UserData?.Played,
      tmdbId: Number(providerId(item, "Tmdb")) || undefined,
      imdbId: providerId(item, "Imdb"),
    }));
}

export async function previewLetterboxd(
  titles: ImportTitle[],
  options: {
    seerr: boolean;
    signal: AbortSignal;
    progress(rows: ImportRow[]): void;
  },
) {
  const identity = integrationIdentity();
  const library = await integrationLibrary("Movie", options.signal);
  const rows: ImportRow[] = [];
  for (let index = 0; index < titles.length; index += 1) {
    options.signal.throwIfAborted();
    requireIntegrationIdentity(identity);
    const title = titles[index];
    const row: ImportRow = {
      ...title,
      id: index,
      candidates: matchLibraryTitle(title, library),
    };
    if (!row.candidates.length && options.seerr) {
      try {
        const page = await getSeerrPage(
          `/search?query=${encodeURIComponent(title.title)}&page=1`,
          options.signal,
        );
        row.candidates = page.results
          .filter(
            (item) =>
              item.mediaType === "movie" &&
              normaliseImportTitle(item.title ?? "") ===
                normaliseImportTitle(title.title) &&
              (!title.year ||
                Number(item.releaseDate?.slice(0, 4)) === title.year),
          )
          .map((item) => ({
            title: item.title ?? title.title,
            year: Number(item.releaseDate?.slice(0, 4)) || undefined,
            tmdbId: item.id,
          }));
      } catch (error) {
        if (options.signal.aborted) throw error;
        row.error =
          error instanceof Error ? error.message : "Seerr lookup failed.";
      }
    }
    if (row.candidates.length === 1) [row.selected] = row.candidates;
    rows.push(row);
    options.progress([...rows]);
  }
  requireIntegrationIdentity(identity);
  return rows;
}

export function candidateWatchlistEntry(
  candidate: ImportCandidate,
  type: "movie" | "tv" = "movie",
): WatchlistEntry {
  return {
    ...candidate,
    type,
    key: candidate.tmdbId
      ? `tmdb:${type}:${candidate.tmdbId}`
      : `jellyfin:${type}:${candidate.jellyfinId}`,
    addedAt: new Date().toISOString(),
  };
}

export async function applyLetterboxd(
  rows: ImportRow[],
  mode: "watchlist" | "watched",
  signal: AbortSignal,
  progress: (completed: number) => void,
) {
  const identity = integrationIdentity();
  const session = getJellyfinSession();
  const existing = new Set(
    (useIntegrationWatchlist.getState().profiles[identity.scope] ?? []).map(
      (item) => item.key,
    ),
  );
  let added = 0;
  let skipped = 0;
  const failures: { title: string; error: string }[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    signal.throwIfAborted();
    requireIntegrationIdentity(identity);
    const { selected, title } = rows[index];
    if (!selected || (mode === "watched" && !selected.jellyfinId)) {
      skipped += 1;
      progress(index + 1);
      continue;
    }
    try {
      if (mode === "watchlist") {
        const [entry] = validateWatchlist([candidateWatchlistEntry(selected)]);
        if (!entry || existing.has(entry.key)) skipped += 1;
        else {
          useIntegrationWatchlist.getState().merge(identity.scope, [entry]);
          existing.add(entry.key);
          added += 1;
        }
      } else {
        const item = await jellyfinRequest<JellyfinItem>(
          `Users/${session.userId}/Items/${selected.jellyfinId}`,
          { signal },
        );
        requireIntegrationIdentity(identity);
        if (item.UserData?.Played) skipped += 1;
        else {
          await jellyfinRequest(
            `Users/${session.userId}/PlayedItems/${selected.jellyfinId}`,
            { method: "POST", signal },
          );
          added += 1;
        }
      }
    } catch (error) {
      signal.throwIfAborted();
      requireIntegrationIdentity(identity);
      failures.push({
        title,
        error: error instanceof Error ? error.message : "Import failed.",
      });
    }
    progress(index + 1);
  }
  return { added, skipped, failures };
}

export function watchlistCsv(entries: WatchlistEntry[]) {
  const cell = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    "Name,Year,Type,TMDB ID,Jellyfin ID",
    ...entries.map((entry) =>
      [entry.title, entry.year, entry.type, entry.tmdbId, entry.jellyfinId]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
