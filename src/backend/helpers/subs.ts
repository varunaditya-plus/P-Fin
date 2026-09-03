import { convertSubtitlesToSrt } from "@/components/player/utils/captions";
import { CaptionListItem } from "@/stores/player/slices/source";
import { SimpleCache } from "@/utils/cache";

const downloadCache = new SimpleCache<string, string>();
downloadCache.setCompare((a, b) => a === b);
const expirySeconds = 24 * 60 * 60;

/**
 * Always returns SRT
 */
export async function downloadCaption(
  caption: CaptionListItem,
): Promise<string> {
  const cached = downloadCache.get(caption.url);
  if (cached) return cached;

  const response = await fetch(caption.url);
  if (!response.ok)
    throw new Error(`Could not load subtitle (${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  const charset = contentType.includes("charset=")
    ? contentType.split("charset=")[1].toLowerCase()
    : "utf-8";
  const buffer = await response.arrayBuffer();
  const data = new TextDecoder(charset).decode(buffer);
  if (!data) throw new Error("failed to get caption data");

  const output = convertSubtitlesToSrt(data);
  downloadCache.set(caption.url, output, expirySeconds);
  return output;
}
