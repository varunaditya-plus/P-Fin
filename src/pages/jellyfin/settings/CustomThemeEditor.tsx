import classNames from "classnames";
import { CSSProperties, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { DetailsModalFrame } from "@/components/overlays/DetailsModalFrame";
import {
  SavedCustomTheme,
  usePreviewThemeStore,
  useThemeStore,
} from "@/stores/theme";
import {
  PalettePart,
  paletteOptions,
  themeVariables,
  validHex,
  validateCustomTheme,
} from "@/stores/theme/customThemes";

const parts: {
  id: PalettePart;
  title: string;
  label: string;
  colors: string[];
}[] = [
  {
    id: "primary",
    title: "Primary colour",
    label: "Accent",
    colors: ["--colors-type-logo"],
  },
  {
    id: "secondary",
    title: "Secondary colour",
    label: "Text and controls",
    colors: ["--colors-type-text", "--colors-buttons-secondary"],
  },
  {
    id: "tertiary",
    title: "Tertiary colour",
    label: "Background",
    colors: ["--colors-background-main", "--colors-modal-background"],
  },
];

function PreviewPoster({ accent }: { accent?: "primary" | "secondary" }) {
  return (
    <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-white/5">
      <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent" />
      {accent ? (
        <div
          className={classNames(
            "absolute inset-0",
            accent === "primary"
              ? "bg-type-logo/25"
              : "bg-buttons-secondary/40",
          )}
        />
      ) : null}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 h-1.5 rounded-full bg-white/20" />
    </div>
  );
}

function ThemeLivePreview({ style }: { style: CSSProperties }) {
  return (
    <div
      data-testid="custom-theme-preview"
      aria-label="Live theme preview"
      style={style}
      className="theme-custom w-full max-w-md mx-auto rounded-xl overflow-hidden border border-white/10 bg-background-main shadow-2xl"
    >
      <div className="relative w-full h-full" aria-hidden="true">
        <div className="bg-type-logo/50 w-[130%] h-16 absolute left-1/2 -top-8 blur-2xl transform -translate-x-1/2 rounded-[100%]" />
        <div className="relative p-3 flex justify-between items-center">
          <div className="flex items-center gap-1.5 rounded-full bg-white/5 pl-1.5 pr-3 py-1">
            <div className="bg-type-logo w-3.5 h-3.5 rounded-full shrink-0" />
            <div className="bg-white/20 w-10 h-1.5 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 w-6 h-1.5 rounded-full" />
            <div className="bg-white/10 w-6 h-1.5 rounded-full" />
            <div className="bg-white/10 w-5 h-5 rounded-full" />
          </div>
        </div>
        <div className="relative mt-3 flex items-center flex-col gap-2 px-6 text-center">
          <div className="bg-white/20 w-36 h-2.5 rounded-full" />
          <div className="bg-white/10 w-24 h-1.5 rounded-full" />
          <div className="flex items-center gap-2 mt-2">
            <div className="bg-type-logo px-4 h-6 rounded-full flex items-center">
              <div className="bg-black/20 w-10 h-1.5 rounded-full" />
            </div>
            <div className="bg-buttons-secondary px-4 h-6 rounded-full flex items-center">
              <div className="bg-black/20 w-10 h-1.5 rounded-full" />
            </div>
          </div>
        </div>
        <div className="mt-6 px-4 pb-4 space-y-4">
          {(["primary", "secondary"] as const).map((accent) => (
            <div key={accent}>
              <div className="flex gap-2 items-center mb-2">
                <div
                  className={classNames(
                    "w-2.5 h-2.5 rounded-full",
                    accent === "primary"
                      ? "bg-type-logo"
                      : "bg-buttons-secondary",
                  )}
                />
                <div className="bg-white/15 w-16 h-1.5 rounded-full" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <PreviewPoster
                  accent={accent === "primary" ? accent : undefined}
                />
                <PreviewPoster
                  accent={accent === "secondary" ? accent : undefined}
                />
                <PreviewPoster />
                <PreviewPoster />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function presetHex(part: PalettePart, id: string) {
  const key = {
    primary: "--colors-buttons-purple",
    secondary: "--colors-type-text",
    tertiary: "--colors-background-main",
  }[part];
  const value =
    paletteOptions[part].find((option) => option.id === id)?.colors[key] ??
    "0 0 0";
  return `#${value
    .split(" ")
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

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
  const savedThemes = useThemeStore((state) => state.savedCustomThemes);
  const editing = savedThemes.some((item) => item.id === initial.id);
  const preview = useMemo(() => {
    const value = { ...draft };
    for (const { id } of parts)
      if (!validHex(value[`${id}Hex`])) delete value[`${id}Hex`];
    return value;
  }, [draft]);
  useEffect(() => {
    if (open) usePreviewThemeStore.getState().setPreviewPalette(preview);
    return () => usePreviewThemeStore.getState().setPreviewPalette(null);
  }, [open, preview]);
  const close = () => {
    usePreviewThemeStore.getState().setPreviewPalette(null);
    onClose();
  };
  const save = () => {
    try {
      const checked = validateCustomTheme(draft);
      useThemeStore.getState().saveCustomTheme(checked);
      useThemeStore.getState().setTheme(checked.id);
      close();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save theme.",
      );
    }
  };
  const changeHex = (id: PalettePart, value: string | undefined) => {
    setDraft((current) => ({ ...current, [`${id}Hex`]: value }));
    setError("");
  };
  return (
    <DetailsModalFrame
      open={open}
      onClose={close}
      afterLeave={afterLeave}
      label={editing ? "Edit custom theme" : "Create custom theme"}
    >
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="w-full max-w-5xl max-h-[92dvh] flex flex-col bg-modal-background rounded-xl text-white pointer-events-auto overflow-hidden shadow-2xl"
        >
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            <div className="shrink-0 lg:shrink lg:flex-1 flex flex-col p-5 sm:p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-utils-divider border-opacity-50 lg:overflow-y-auto">
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-4 flex flex-wrap gap-x-3 md:block">
                <span>{editing ? "Edit" : "Create"}</span>
                <br className="hidden md:block" />
                <span>Your Own Theme</span>
              </h1>
              <div className="my-4">
                <input
                  aria-label="Theme name"
                  name="theme-name"
                  className="tabbable w-full text-xl lg:text-2xl font-bold bg-dropdown-background focus:bg-dropdown-hoverBackground rounded-lg px-4 py-3 border-none outline-none text-white placeholder-type-secondary transition-colors min-w-0"
                  placeholder="Name your theme..."
                  value={draft.name}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </div>
              <div className="flex-1 flex flex-col justify-center py-4">
                <ThemeLivePreview
                  style={themeVariables(preview) as CSSProperties}
                />
              </div>
            </div>
            <div className="w-full lg:w-[46%] shrink-0 lg:shrink flex flex-col gap-7 p-5 sm:p-6 md:p-8 lg:overflow-y-auto lg:overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-type-secondary">
              {parts.map(({ id, title, label, colors }) => {
                const hex = draft[`${id}Hex`];
                const custom = hex !== undefined;
                return (
                  <fieldset key={id} className="space-y-4 min-w-0">
                    <legend className="sr-only">{title}</legend>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg lg:text-xl font-bold text-white">
                        {title}
                      </h2>
                      <button
                        type="button"
                        title="Custom colour"
                        aria-label={`${label} custom colour`}
                        aria-pressed={custom}
                        onClick={() =>
                          changeHex(
                            id,
                            custom ? undefined : presetHex(id, draft[id]),
                          )
                        }
                        className={classNames(
                          "tabbable w-9 h-9 flex items-center justify-center rounded-lg transition-colors",
                          custom
                            ? "bg-dropdown-highlight bg-opacity-30 text-white"
                            : "bg-dropdown-background text-type-secondary hover:text-white hover:bg-dropdown-hoverBackground",
                        )}
                      >
                        <Icon icon={Icons.BRUSH} className="text-base" />
                      </button>
                    </div>
                    {custom ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 md:w-14 md:h-14 shrink-0">
                          <div
                            className="absolute inset-0 rounded-xl shadow-lg ring-1 ring-inset ring-white/15"
                            style={{
                              backgroundColor: validHex(hex)
                                ? hex
                                : presetHex(id, draft[id]),
                            }}
                          />
                          <input
                            type="color"
                            aria-label={`${label} colour picker`}
                            value={
                              validHex(hex) ? hex : presetHex(id, draft[id])
                            }
                            onChange={(event) =>
                              changeHex(id, event.target.value)
                            }
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer tabbable rounded-xl"
                          />
                        </div>
                        <input
                          aria-label={`${label} hex colour`}
                          aria-invalid={Boolean(hex && !validHex(hex))}
                          className="tabbable min-w-0 w-28 rounded-lg bg-dropdown-background px-3 py-2 font-mono text-sm uppercase text-white"
                          value={hex}
                          maxLength={7}
                          placeholder="#rrggbb"
                          onChange={(event) =>
                            changeHex(id, event.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <div
                        role="group"
                        aria-label={`${label} palette`}
                        className="flex flex-wrap gap-3"
                      >
                        {paletteOptions[id].map((option) => {
                          const selected = draft[id] === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              title={option.id}
                              aria-label={`${label}: ${option.id}`}
                              aria-pressed={selected}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  [id]: option.id,
                                }))
                              }
                              className={classNames(
                                "tabbable relative w-12 h-12 md:w-14 md:h-14 rounded-xl shrink-0 cursor-pointer overflow-hidden transition-transform duration-200 ease-out shadow-lg motion-reduce:transition-none",
                                selected
                                  ? "ring-2 ring-white ring-offset-2 ring-offset-modal-background scale-105"
                                  : "hover:scale-105",
                              )}
                            >
                              <span className="absolute inset-0 flex">
                                {colors.map((key) => (
                                  <span
                                    key={key}
                                    className="flex-1 h-full"
                                    style={{
                                      backgroundColor: `rgb(${option.colors[key] ?? "0 0 0"})`,
                                    }}
                                  />
                                ))}
                              </span>
                              {selected ? (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <Icon
                                    icon={Icons.CHECKMARK}
                                    className="text-white text-xl [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.9))]"
                                  />
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 border-t border-utils-divider border-opacity-50 px-5 sm:px-6 md:px-8 py-4">
            {error ? (
              <p role="alert" className="mb-3 text-type-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
              <Button
                theme="secondary"
                className="w-full sm:w-auto sm:flex-1"
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                theme="purple"
                className="w-full sm:w-auto sm:flex-[2]"
                disabled={!draft.name.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DetailsModalFrame>
  );
}
