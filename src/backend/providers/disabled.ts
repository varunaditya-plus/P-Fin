/** Compatibility types for p-stream's retained player. External providers are disabled. */
export type Qualities = "unknown" | "360" | "480" | "720" | "1080" | "4k";
export interface ProviderCaption {
  id: string;
  language: string;
  url: string;
  type: string;
  hasCorsRestrictions: boolean;
  opensubtitles?: boolean;
}
interface BaseStream {
  id: string;
  flags: string[];
  captions: ProviderCaption[];
  headers?: Record<string, string>;
  preferredHeaders?: Record<string, string>;
}
export type Stream =
  | (BaseStream & { type: "hls"; playlist: string })
  | (BaseStream & {
      type: "file";
      qualities: Partial<Record<Qualities, { type: "mp4"; url: string }>>;
    });
interface MediaBase {
  title: string;
  releaseYear: number;
  tmdbId: string;
  imdbId?: string;
}
export type ScrapeMedia =
  | (MediaBase & { type: "movie" })
  | (MediaBase & {
      type: "show";
      episode: { number: number; tmdbId: string };
      season: { number: number; tmdbId: string };
    });
export interface MetaOutput {
  id: string;
  name: string;
  rank: number;
  type: "source" | "embed";
  disabled?: boolean;
  mediaTypes?: string[];
}
export interface RunOutput {
  sourceId: string;
  embedId?: string;
  stream: Stream;
}
export interface Embed {
  embedId: string;
  url: string;
}
export interface EmbedOutput {
  stream: Stream[];
}
export interface SourcererOutput {
  stream?: Stream[];
  embeds: Embed[];
}

export interface FullScraperEvents {
  init?: (event: { sourceIds: string[] }) => void;
  start?: (id: string) => void;
  update?: (event: {
    id: string;
    status: "failure" | "pending" | "notfound" | "success" | "waiting";
    reason?: string;
    error?: unknown;
    percentage: number;
  }) => void;
  discoverEmbeds?: (event: {
    sourceId: string;
    embeds: { id: string; embedScraperId: string }[];
  }) => void;
}
export class NotFoundError extends Error {}
export interface ProviderControls {
  listSources(): MetaOutput[];
  listEmbeds(): MetaOutput[];
  getMetadata(id?: string): MetaOutput | undefined;
  runAll(options: unknown): Promise<RunOutput | null>;
  runSourceScraper(
    options: unknown,
  ): Promise<{ stream?: Stream[]; embeds: Embed[] }>;
  runEmbedScraper(options: unknown): Promise<{ stream: Stream[] }>;
}
const disabled = async (): Promise<never> => {
  throw new Error(
    "External streaming providers are disabled. Choose content from your Jellyfin library.",
  );
};
export const targets = {
  NATIVE: "native",
  BROWSER: "browser",
  BROWSER_EXTENSION: "extension",
};
export function makeProviders(_options?: unknown): ProviderControls {
  return {
    listSources: () => [],
    listEmbeds: () => [],
    getMetadata: () => undefined,
    runAll: disabled,
    runSourceScraper: disabled,
    runEmbedScraper: disabled,
  };
}
export type Fetcher = (
  url: string,
  options: {
    body?: unknown;
    readHeaders: string[];
    headers?: Record<string, string>;
    method: string;
    [key: string]: unknown;
  },
) => Promise<{
  body: any;
  finalUrl: string;
  statusCode: number;
  headers: Headers;
}>;
export const makeStandardFetcher = (_fetch?: unknown): Fetcher => disabled;
export const makeSimpleProxyFetcher = (
  _url?: unknown,
  _fetch?: unknown,
): Fetcher => disabled;
export const setM3U8ProxyUrl = (_url: string): void => {};
export function labelToLanguageCode(label: string) {
  const languages: Record<string, string> = {
    english: "en",
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    portuguese: "pt",
    japanese: "ja",
    hindi: "hi",
  };
  return (
    languages[label.toLowerCase()] ??
    (label.length <= 3 ? label.toLowerCase() : null)
  );
}
