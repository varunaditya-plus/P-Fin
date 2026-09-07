import { useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { HomePreferences, orderedHomeSections } from "@/stores/jellyfin/home";

export function HomeLayoutControls({
  sections,
  preferences,
  onChange,
  onReset,
}: {
  sections: { id: string; title: string }[];
  preferences: HomePreferences;
  onChange: (changes: Partial<HomePreferences>) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ordered = orderedHomeSections(sections, preferences);
  const move = (index: number, direction: number) => {
    const ids = ordered.map((section) => section.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    onChange({ order: ids });
  };
  return (
    <div>
      <Button theme="secondary" onClick={() => setOpen((value) => !value)}>
        {open ? "Done editing" : "Edit layout"}
      </Button>
      {open ? (
        <div
          className="mt-4 rounded-xl bg-background-secondary p-5 space-y-5"
          aria-label="Home layout"
        >
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-2 text-sm">
              Layout
              <select
                className="rounded-lg bg-dropdown-background p-3 text-white"
                value={preferences.layout}
                onChange={(event) =>
                  onChange({
                    layout: event.target.value as HomePreferences["layout"],
                  })
                }
              >
                <option value="carousel">Carousels</option>
                <option value="grid">Grids</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Poster size
              <select
                className="rounded-lg bg-dropdown-background p-3 text-white"
                value={preferences.density}
                onChange={(event) =>
                  onChange({
                    density: event.target.value as HomePreferences["density"],
                  })
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            {preferences.layout === "grid" ? (
              <label className="flex flex-col gap-2 text-sm">
                Rows per section
                <select
                  className="rounded-lg bg-dropdown-background p-3 text-white"
                  value={preferences.rows}
                  onChange={(event) =>
                    onChange({ rows: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="space-y-2">
            {ordered.map((section, index) => (
              <div key={section.id} className="flex items-center gap-3">
                <label className="flex flex-1 items-center gap-3 text-white">
                  <input
                    type="checkbox"
                    checked={!preferences.hidden.includes(section.id)}
                    onChange={(event) =>
                      onChange({
                        hidden: event.target.checked
                          ? preferences.hidden.filter((id) => id !== section.id)
                          : [...preferences.hidden, section.id],
                      })
                    }
                  />
                  {section.title}
                </label>
                <button
                  className="rounded-lg px-3 py-2 text-white hover:bg-button-secondaryHover disabled:opacity-30"
                  type="button"
                  aria-label={`Move ${section.title} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <Icon icon={Icons.CHEVRON_LEFT} className="rotate-90" />
                </button>
                <button
                  className="rounded-lg px-3 py-2 text-white hover:bg-button-secondaryHover disabled:opacity-30"
                  type="button"
                  aria-label={`Move ${section.title} down`}
                  disabled={index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <Icon icon={Icons.CHEVRON_LEFT} className="-rotate-90" />
                </button>
              </div>
            ))}
          </div>
          <Button theme="secondary" onClick={onReset}>
            Reset layout
          </Button>
        </div>
      ) : null}
    </div>
  );
}
