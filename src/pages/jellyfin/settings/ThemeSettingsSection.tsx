import classNames from "classnames";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { useRetainedModalValue } from "@/components/overlays/DetailsModalFrame";
import { Heading1 } from "@/components/utils/Text";
import {
  ThemePreview,
  availableThemes,
} from "@/pages/parts/settings/AppearancePart";
import { SavedCustomTheme, useThemeStore } from "@/stores/theme";
import {
  MAX_CUSTOM_THEMES,
  defaultPalette,
  themeVariables,
} from "@/stores/theme/customThemes";

import { CustomThemeEditor } from "./CustomThemeEditor";

export { CustomThemeEditor } from "./CustomThemeEditor";

export function ThemeSettingsSection() {
  const theme = useThemeStore();
  const { t } = useTranslation();
  const [editing, setEditing] = useState<SavedCustomTheme | null>(null);
  const retainedEditor = useRetainedModalValue(editing);
  const [confirmReset, setConfirmReset] = useState(false);
  const gallery = useRef<HTMLDivElement>(null);
  const activeTile = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: true, bottom: false });
  const updateEdges = () => {
    const element = gallery.current;
    if (element)
      setEdges({
        top: element.scrollTop < 4,
        bottom:
          element.scrollHeight - element.clientHeight - element.scrollTop < 4,
      });
  };
  useEffect(() => {
    const container = gallery.current;
    const selected = activeTile.current;
    if (container && selected) {
      container.scrollTop +=
        selected.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        (container.clientHeight - selected.clientHeight) / 2;
    }
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [
    theme.theme,
    theme.hiddenDefaultThemes.length,
    theme.savedCustomThemes.length,
  ]);
  const createTheme = () =>
    setEditing({
      id: `custom-${crypto.randomUUID()}`,
      name: "",
      ...defaultPalette,
      primary: "default",
      secondary: "default",
      tertiary: "default",
    });
  return (
    <section className="space-y-6 min-w-0">
      <Heading1 border>Themes</Heading1>
      <div
        ref={gallery}
        onScroll={updateEdges}
        aria-label="Theme gallery"
        className={classNames(
          "grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-h-[36rem] md:max-h-[64rem] overflow-y-auto pr-3 py-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-type-secondary vertical-carousel-container",
          {
            "hide-top-gradient": edges.top,
            "hide-bottom-gradient": edges.bottom,
          },
        )}
      >
        {availableThemes
          .filter(
            (item) =>
              item.id !== "custom" &&
              !theme.hiddenDefaultThemes.includes(item.id),
          )
          .map((item) => {
            const selected = (theme.theme ?? "default") === item.id;
            return (
              <div
                key={item.id}
                ref={selected ? activeTile : undefined}
                className="relative min-w-0"
              >
                <ThemePreview
                  selector={item.selector}
                  name={t(item.key)}
                  active={selected}
                  inUse={selected}
                  onClick={() => theme.setTheme(item.id)}
                />
                {item.id !== "default" ? (
                  <button
                    type="button"
                    title={`Hide ${t(item.key)} theme`}
                    aria-label={`Hide ${t(item.key)} theme`}
                    className="tabbable absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/50 transition-colors hover:bg-black/70 hover:text-white"
                    onClick={() => theme.hideDefaultTheme(item.id)}
                  >
                    <Icon icon={Icons.X} className="text-xs" />
                  </button>
                ) : null}
              </div>
            );
          })}
        {theme.savedCustomThemes.map((item) => (
          <div
            key={item.id}
            ref={theme.theme === item.id ? activeTile : undefined}
            className="theme-custom relative min-w-0"
            style={themeVariables(item) as CSSProperties}
          >
            <ThemePreview
              name={item.name}
              active={theme.theme === item.id}
              inUse={theme.theme === item.id}
              onClick={() => theme.setTheme(item.id)}
            />
            <div className="absolute right-1 top-1 flex gap-1">
              <button
                type="button"
                title={`Edit ${item.name}`}
                aria-label={`Edit ${item.name}`}
                className="tabbable flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/50 transition-colors hover:bg-black/70 hover:text-white"
                onClick={() => setEditing(item)}
              >
                <Icon icon={Icons.EDIT} className="text-xs" />
              </button>
              <button
                type="button"
                title={`Delete ${item.name}`}
                aria-label={`Delete ${item.name}`}
                className="tabbable flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/50 transition-colors hover:bg-black/70 hover:text-white"
                onClick={() => theme.deleteCustomTheme(item.id)}
              >
                <Icon icon={Icons.X} className="text-xs" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={theme.savedCustomThemes.length >= MAX_CUSTOM_THEMES}
          onClick={createTheme}
          className="tabbable group flex flex-col justify-center items-center h-32 rounded-lg border border-dashed border-white/20 transition-colors p-4 text-center hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon
            icon={Icons.PLUS}
            className="text-4xl text-white/50 transition-colors group-hover:text-white"
          />
          <span className="mt-2 font-medium text-sm sm:text-base leading-tight text-white/70 group-hover:text-white">
            Create Custom Theme
          </span>
          {theme.savedCustomThemes.length >= MAX_CUSTOM_THEMES ? (
            <span className="text-xs text-type-danger mt-1">
              Theme limit reached ({MAX_CUSTOM_THEMES} max)
            </span>
          ) : null}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-type-secondary">
          {theme.savedCustomThemes.length} of {MAX_CUSTOM_THEMES} custom themes
        </span>
        <div className="flex flex-wrap justify-end gap-3">
          {theme.hiddenDefaultThemes.length ? (
            <Button
              theme="secondary"
              onClick={() =>
                useThemeStore.setState({ hiddenDefaultThemes: [] })
              }
            >
              Show built-in themes
            </Button>
          ) : null}
          <Button theme="secondary" onClick={() => setConfirmReset(true)}>
            <span className="flex items-center gap-2">
              <Icon icon={Icons.ARROW_LEFT} />
              Reset to Default
            </span>
          </Button>
        </div>
      </div>
      {confirmReset ? (
        <div
          role="group"
          aria-label="Reset themes"
          className="rounded-lg border border-white/10 bg-dropdown-background p-4 space-y-3"
        >
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
