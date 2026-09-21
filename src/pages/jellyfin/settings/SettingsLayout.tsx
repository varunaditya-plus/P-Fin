import classNames from "classnames";
import {
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import { SearchBarInput } from "@/components/form/SearchBar";
import { Icon, Icons } from "@/components/Icon";
import { WideContainer } from "@/components/layout/WideContainer";

export const settingsCategories = [
  {
    id: "preferences",
    label: "Preferences",
    icon: Icons.SETTINGS,
    keywords:
      "language interface controls keyboard shortcuts game controller gamepad performance hold boost double click seek number keys",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Icons.BRUSH,
    keywords:
      "themes custom colours colors accent background featured carousel image logos minimal cards pause overlay compact episode list",
  },
  {
    id: "playback",
    label: "Jellyfin playback",
    icon: Icons.PLAY,
    keywords:
      "audio language subtitle mode default forced smart remember selections autoplay automatically next episode",
  },
  {
    id: "captions",
    label: "Subtitles",
    icon: Icons.CAPTIONS,
    keywords:
      "captions native subtitle background blur opacity text size style bold color colour border thickness line height position preview",
  },
  {
    id: "connections",
    label: "Connections",
    icon: Icons.LINK,
    keywords:
      "integrations simkl trakt letterboxd watchlist lists history import",
  },
  {
    id: "backup",
    label: "Settings and backup",
    icon: Icons.DOWNLOAD,
    keywords:
      "export import backup file account sync synced jellyfin preferences",
  },
];
const SettingsVisibility = createContext({ category: "", query: "" });
export function matchesSettingsSearch(id: string, query: string) {
  const category = settingsCategories.find((entry) => entry.id === id);
  const text = `${category?.label} ${category?.keywords}`.toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((term) => text.includes(term));
}

export function SettingsPageSection({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const selection = useContext(SettingsVisibility);
  const visible = selection.query.trim()
    ? matchesSettingsSearch(id, selection.query)
    : !selection.category || selection.category === id;
  return (
    <div
      id={`settings-${id}`}
      hidden={!visible}
      className="space-y-10 scroll-mt-36"
    >
      {children}
    </div>
  );
}

export function SettingsLayout({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const requestedCategory =
    params.get("category")?.replace(/^settings-/, "") ?? "";
  const category = settingsCategories.some(
    (entry) => entry.id === requestedCategory,
  )
    ? requestedCategory
    : "";
  const setCategory = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set("category", `settings-${value}`);
        else next.delete("category");
        return next;
      },
      { replace: true },
    );
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const visibility = useMemo(() => ({ category, query }), [category, query]);
  const noMatches =
    query.trim() &&
    !settingsCategories.some((entry) => matchesSettingsSearch(entry.id, query));
  return (
    <WideContainer ultraWide classNames="overflow-visible">
      <div className="mb-8 xl:fixed xl:top-[calc(14px+env(safe-area-inset-top))] xl:left-1/2 xl:-translate-x-1/2 xl:z-[550] xl:mb-0 xl:w-[min(600px,calc(100vw-720px))]">
        <SearchBarInput
          ref={search}
          value={query}
          onChange={setQuery}
          onUnFocus={(value) => {
            if (value !== undefined) setQuery(value);
          }}
          placeholder="Search settings"
          isSticky
          hideTooltip
        />
      </div>
      <div
        className="grid gap-8 lg:gap-12 lg:grid-cols-[280px,minmax(0,1fr)] pb-12"
        data-settings-content
      >
        <nav
          aria-label="Settings categories"
          className="text-settings-sidebar-type-inactive"
        >
          <div className="lg:sticky lg:top-32">
            <p className="mb-2 text-sm font-bold uppercase text-settings-sidebar-type-secondary">
              Settings
            </p>
            <div className="flex gap-1 overflow-x-auto pb-2 lg:block lg:overflow-visible lg:pb-0">
              {[
                { id: "", label: "All settings", icon: Icons.GEAR },
                ...settingsCategories,
              ].map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={
                    !query.trim() && category === entry.id ? "page" : undefined
                  }
                  onClick={() => {
                    setCategory(entry.id);
                    setQuery("");
                  }}
                  className={classNames(
                    "tabbable flex shrink-0 items-center gap-3 rounded px-3 py-2 text-left lg:my-2 lg:w-full",
                    !query.trim() &&
                      category === entry.id &&
                      "bg-settings-sidebar-activeLink text-settings-sidebar-type-activated",
                  )}
                >
                  <Icon
                    icon={entry.icon}
                    className={classNames(
                      "text-2xl text-settings-sidebar-type-icon",
                      !query.trim() &&
                        category === entry.id &&
                        "text-settings-sidebar-type-iconActivated",
                    )}
                  />
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
        <main className="min-w-0 space-y-12">
          {noMatches ? (
            <p role="status" className="text-type-secondary">
              No settings match “{query}”. Try another word.
            </p>
          ) : null}
          <SettingsVisibility.Provider value={visibility}>
            {children}
          </SettingsVisibility.Provider>
        </main>
      </div>
    </WideContainer>
  );
}
