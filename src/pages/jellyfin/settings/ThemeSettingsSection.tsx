import { CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import {
  DetailsModalFrame,
  useRetainedModalValue,
} from "@/components/overlays/DetailsModalFrame";
import { Heading1 } from "@/components/utils/Text";
import {
  ThemePreview,
  availableThemes,
} from "@/pages/parts/settings/AppearancePart";
import { SavedCustomTheme, useThemeStore } from "@/stores/theme";
import {
  MAX_CUSTOM_THEMES,
  PalettePart,
  defaultPalette,
  paletteOptions,
  themeVariables,
  validHex,
  validateCustomTheme,
} from "@/stores/theme/customThemes";

const partLabels: Record<PalettePart, string> = {
  primary: "Accent",
  secondary: "Text and controls",
  tertiary: "Background",
};
const inputClass =
  "w-full rounded-lg bg-dropdown-background px-4 py-3 text-white border border-white/10 focus:border-buttons-purple";

export function CustomThemeEditor({
  initial,
  onClose,
  open = true,
  afterLeave = () => {},
}: {
  initial: SavedCustomTheme;
  onClose: () => void;
  open?: boolean;
  afterLeave?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const theme = useThemeStore();
  const preview = { ...draft };
  for (const part of Object.keys(paletteOptions) as PalettePart[]) {
    if (!validHex(preview[`${part}Hex`])) delete preview[`${part}Hex`];
  }
  const save = () => {
    try {
      const checked = validateCustomTheme(draft);
      theme.saveCustomTheme(checked);
      theme.setTheme(checked.id);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save theme.",
      );
    }
  };
  return (
    <DetailsModalFrame
      open={open}
      onClose={onClose}
      afterLeave={afterLeave}
      label="Custom theme"
    >
      <div className="fixed inset-0 overflow-y-auto pointer-events-auto p-4 sm:p-8">
        <div className="mx-auto my-4 max-w-5xl rounded-xl border border-white/10 bg-background-main p-5 sm:p-8 shadow-xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white">Custom theme</h2>
            <Button theme="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <label className="block space-y-2 text-white">
                Theme name
                <input
                  className={inputClass}
                  value={draft.name}
                  maxLength={60}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  autoComplete="off"
                />
              </label>
              {(Object.keys(paletteOptions) as PalettePart[]).map((part) => (
                <fieldset key={part} className="space-y-2">
                  <legend className="mb-2 font-medium text-white">
                    {partLabels[part]}
                  </legend>
                  <select
                    aria-label={`${partLabels[part]} palette`}
                    className={inputClass}
                    value={draft[part]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [part]: event.target.value,
                        [`${part}Hex`]: undefined,
                      })
                    }
                  >
                    {paletteOptions[part].map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.id[0].toUpperCase() + option.id.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 items-center">
                    <input
                      aria-label={`${partLabels[part]} colour picker`}
                      type="color"
                      className="h-10 w-12 cursor-pointer rounded bg-transparent"
                      value={
                        validHex(draft[`${part}Hex`])
                          ? draft[`${part}Hex`]
                          : "#8b5cf6"
                      }
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [`${part}Hex`]: event.target.value,
                        })
                      }
                    />
                    <input
                      aria-label={`${partLabels[part]} hex colour`}
                      className={inputClass}
                      placeholder="Optional #rrggbb"
                      value={draft[`${part}Hex`] ?? ""}
                      maxLength={7}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [`${part}Hex`]: event.target.value,
                        })
                      }
                    />
                    <button
                      type="button"
                      className="tabbable text-sm text-type-link"
                      onClick={() =>
                        setDraft({ ...draft, [`${part}Hex`]: undefined })
                      }
                    >
                      Reset
                    </button>
                  </div>
                </fieldset>
              ))}
              {error ? (
                <p role="alert" className="text-type-danger">
                  {error}
                </p>
              ) : null}
              <Button type="submit" theme="purple">
                Save theme
              </Button>
            </form>
            <div className="min-w-0 md:sticky md:top-4 md:self-start">
              <p className="mb-3 text-sm text-type-secondary">Live preview</p>
              <div
                data-testid="custom-theme-preview"
                style={themeVariables(preview) as CSSProperties}
                className="theme-custom overflow-hidden rounded-xl border border-white/10 bg-background-main text-type-text"
              >
                <div className="bg-largeCard-background p-5 flex justify-between items-center">
                  <span className="font-bold text-type-text">Your library</span>
                  <span className="text-type-link text-sm">Discover</span>
                </div>
                <div className="p-5 space-y-5">
                  <div className="rounded-lg bg-gradient-to-br from-buttons-purple/30 to-background-main p-5">
                    <h3 className="text-xl font-bold text-type-text">
                      Movie night
                    </h3>
                    <p className="mt-2 text-type-secondary">
                      Pick up where you left off.
                    </p>
                    <div className="mt-5 inline-flex rounded-lg bg-buttons-purple px-4 py-2 font-bold text-buttons-purpleText">
                      Play now
                    </div>
                  </div>
                  <p className="font-bold text-type-text">Continue watching</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((card) => (
                      <div
                        key={card}
                        className="aspect-[2/3] rounded-lg bg-mediaCard-hoverBackground border border-type-secondary/20"
                      >
                        <div className="mt-[120%] h-1 bg-buttons-purple" />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-type-secondary">
                    Text, backgrounds and colours update as you edit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DetailsModalFrame>
  );
}

export function ThemeSettingsSection() {
  const theme = useThemeStore();
  const { t } = useTranslation();
  const [editing, setEditing] = useState<SavedCustomTheme | null>(null);
  const retainedEditor = useRetainedModalValue(editing);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <section className="space-y-6">
      <Heading1 border>Themes</Heading1>
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          theme="purple"
          disabled={theme.savedCustomThemes.length >= MAX_CUSTOM_THEMES}
          onClick={() =>
            setEditing({
              id: `custom-${crypto.randomUUID()}`,
              name: "",
              ...defaultPalette,
            })
          }
        >
          Create theme
        </Button>
        <span className="text-sm text-type-secondary">
          {theme.savedCustomThemes.length} of {MAX_CUSTOM_THEMES} custom themes
        </span>
        {theme.hiddenDefaultThemes.length ? (
          <Button
            theme="secondary"
            onClick={() => useThemeStore.setState({ hiddenDefaultThemes: [] })}
          >
            Show built-in themes
          </Button>
        ) : null}
        <Button theme="secondary" onClick={() => setConfirmReset(true)}>
          Reset themes
        </Button>
      </div>
      {confirmReset ? (
        <div className="rounded-lg border border-white/10 bg-dropdown-background p-4 space-y-3">
          <p>Delete your custom themes and restore the built-in themes?</p>
          <div className="flex gap-3">
            <Button
              theme="purple"
              onClick={() => {
                theme.resetThemes();
                setConfirmReset(false);
              }}
            >
              Reset all themes
            </Button>
            <Button theme="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {availableThemes
          .filter(
            (item) =>
              item.id !== "custom" &&
              !theme.hiddenDefaultThemes.includes(item.id),
          )
          .map((item) => (
            <div key={item.id}>
              <ThemePreview
                selector={item.selector}
                name={t(item.key)}
                active={(theme.theme ?? "default") === item.id}
                inUse={(theme.theme ?? "default") === item.id}
                onClick={() => theme.setTheme(item.id)}
              />
              <button
                type="button"
                className="tabbable mt-2 text-xs text-type-secondary hover:text-white"
                onClick={() => theme.hideDefaultTheme(item.id)}
                aria-label={`Hide ${t(item.key)} theme`}
              >
                Hide
              </button>
            </div>
          ))}
        {theme.savedCustomThemes.map((item) => (
          <div
            key={item.id}
            className="theme-custom"
            style={themeVariables(item) as CSSProperties}
          >
            <ThemePreview
              name={item.name}
              active={theme.theme === item.id}
              inUse={theme.theme === item.id}
              onClick={() => theme.setTheme(item.id)}
            />
            <div className="mt-2 flex gap-4 text-xs">
              <button
                type="button"
                className="tabbable text-type-link"
                onClick={() => setEditing(item)}
                aria-label={`Edit ${item.name}`}
              >
                Edit
              </button>
              <button
                type="button"
                className="tabbable text-type-secondary hover:text-white"
                onClick={() => theme.deleteCustomTheme(item.id)}
                aria-label={`Delete ${item.name}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {retainedEditor.value ? (
        <CustomThemeEditor
          key={retainedEditor.value.id}
          initial={retainedEditor.value}
          open={retainedEditor.open}
          afterLeave={retainedEditor.afterLeave}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
