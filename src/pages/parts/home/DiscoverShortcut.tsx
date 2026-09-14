import { Link } from "react-router-dom";

import { Icon, Icons } from "@/components/Icon";

import "./discoverShortcut.css";

export function DiscoverShortcut({ query }: { query: string }) {
  return (
    <Link
      to={`/discover${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`}
      aria-label="Discover and request content"
      title="Discover and request content"
      className="discover-shortcut tabbable shrink-0 rounded-full p-px"
    >
      <span className="flex h-12 items-center justify-center rounded-full bg-search-background px-4 text-white sm:h-14">
        <Icon icon={Icons.RISING_STAR} className="text-lg" />
        <span className="discover-shortcut-label overflow-hidden whitespace-nowrap text-sm font-medium">
          Discover
        </span>
      </span>
    </Link>
  );
}
