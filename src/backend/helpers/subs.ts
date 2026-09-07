import { convertSubtitlesToSrt } from "@/components/player/utils/captions";
import { isTTML, parseTTML } from "@/components/player/utils/ttml";
import { CaptionListItem } from "@/stores/player/slices/source";

const cache = new Map<string, { text: string; expires: number }>();
const pending = new Map<
  string,
  { promise: Promise<string>; controller: AbortController; users: Set<symbol> }
>();

export function decodeSubtitle(
  buffer: ArrayBuffer,
  contentType: string,
  encoding?: string,
) {
  const bytes = new Uint8Array(buffer);
  const charset =
    contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] ??
    encoding ??
    "utf-8";
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(
      bytes[0] === 0xff && bytes[1] === 0xfe
        ? "utf-16le"
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? "utf-16be"
          : charset,
    );
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  return decoder.decode(buffer).replace(/^\uFEFF/, "");
}

/** Retain TTML presentation; other text formats are normalised to SRT once. */
export function downloadCaption(
  caption: CaptionListItem,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted)
    return Promise.reject(
      new DOMException("Subtitle request cancelled.", "AbortError"),
    );
  const key = `${caption.url}\n${caption.encoding ?? ""}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now())
    return Promise.resolve(cached.text);
  if (cached) cache.delete(key);
  let entry = pending.get(key);
  if (!entry || entry.controller.signal.aborted) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const request = {
      controller,
      users: new Set<symbol>(),
      promise: Promise.resolve(""),
    };
    request.promise = (async () => {
      const response = await fetch(caption.url, { signal: controller.signal });
      if (!response.ok)
        throw new Error(`Could not load subtitle (${response.status}).`);
      if (Number(response.headers.get("content-length")) > 10_000_000)
        throw new Error("This subtitle file is too large.");
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 10_000_000)
        throw new Error("This subtitle file is too large.");
      const data = decodeSubtitle(
        buffer,
        response.headers.get("content-type") ?? "",
        caption.encoding,
      );
      if (!data.trim()) throw new Error("This subtitle track is empty.");
      let text: string;
      if (isTTML(data)) {
        parseTTML(data);
        text = data;
      } else text = convertSubtitlesToSrt(data);
      if (!controller.signal.aborted) {
        if (cache.size >= 20) cache.delete(cache.keys().next().value!);
        cache.set(key, { text, expires: Date.now() + 60 * 60 * 1000 });
      }
      return text;
    })().finally(() => {
      clearTimeout(timer);
      if (pending.get(key) === request) pending.delete(key);
    });
    entry = request;
    pending.set(key, entry);
  }
  const shared = entry;
  const user = Symbol("subtitle consumer");
  shared.users.add(user);
  return new Promise<string>((resolve, reject) => {
    const done = () => {
      // eslint-disable-next-line no-use-before-define
      signal?.removeEventListener("abort", abort);
      shared.users.delete(user);
    };
    const abort = () => {
      done();
      if (!shared.users.size) shared.controller.abort();
      reject(new DOMException("Subtitle request cancelled.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    shared.promise.then(
      (text) => {
        done();
        if (!signal?.aborted) resolve(text);
      },
      (error) => {
        done();
        reject(error);
      },
    );
  });
}
