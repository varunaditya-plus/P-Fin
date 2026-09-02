import { ContentItem } from "@/backend/jellyfin/content";
import { Icon, Icons } from "@/components/Icon";

type Provider = "imdb" | "tmdb";
interface ProviderLink {
  provider: Provider;
  url: string;
}

function providerFromExternalUrl(value?: string): ProviderLink | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "imdb.com") {
      const id = /^\/title\/(tt\d+)(?:\/|$)/i.exec(url.pathname)?.[1];
      if (id)
        return { provider: "imdb", url: `https://www.imdb.com/title/${id}` };
    }
    if (hostname === "themoviedb.org") {
      const match = /^\/(movie|tv)\/(\d+)(?:[/-]|$)/i.exec(url.pathname);
      if (match)
        return {
          provider: "tmdb",
          url: `https://www.themoviedb.org/${match[1].toLowerCase()}/${match[2]}`,
        };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function isContentProviderUrl(value?: string) {
  return Boolean(providerFromExternalUrl(value));
}

export function getContentProviderLinks(
  item: Pick<ContentItem, "Type" | "ProviderIds" | "ExternalUrls">,
): ProviderLink[] {
  const providerId = (name: string) =>
    Object.entries(item.ProviderIds ?? {}).find(
      ([key]) => key.toLowerCase() === name,
    )?.[1];
  const imdbId = providerId("imdb");
  const tmdbId = providerId("tmdb");
  const external = item.ExternalUrls?.map((entry) =>
    providerFromExternalUrl(entry.Url),
  ).filter((entry): entry is ProviderLink => Boolean(entry));
  const imdb =
    imdbId && /^tt\d+$/i.test(imdbId)
      ? {
          provider: "imdb" as const,
          url: `https://www.imdb.com/title/${imdbId}`,
        }
      : external?.find((entry) => entry.provider === "imdb");
  const tmdb =
    tmdbId && /^\d+$/.test(tmdbId) && ["Movie", "Series"].includes(item.Type)
      ? {
          provider: "tmdb" as const,
          url: `https://www.themoviedb.org/${item.Type === "Series" ? "tv" : "movie"}/${tmdbId}`,
        }
      : external?.find((entry) => entry.provider === "tmdb");
  return [imdb, tmdb].filter((entry): entry is ProviderLink => Boolean(entry));
}

export function ContentProviderLinks({
  item,
  className = "",
}: {
  item: ContentItem;
  className?: string;
}) {
  const links = getContentProviderLinks(item);
  if (!links.length) return null;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {links.map(({ provider, url }) => (
        <a
          key={provider}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View on ${provider === "imdb" ? "IMDb" : "TMDB"} (opens in a new tab)`}
          title={provider === "imdb" ? "IMDb" : "TMDB"}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none ${provider === "imdb" ? "bg-yellow-500" : "bg-[#0d253f]"}`}
        >
          <Icon
            icon={provider === "imdb" ? Icons.IMDB : Icons.TMDB}
            className={`text-sm ${provider === "imdb" ? "text-black" : "text-white"}`}
          />
        </a>
      ))}
    </div>
  );
}
