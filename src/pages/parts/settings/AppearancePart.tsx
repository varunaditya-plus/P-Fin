import classNames from "classnames";
import { useTranslation } from "react-i18next";

import { Icon, Icons } from "@/components/Icon";

export const availableThemes = [
  {
    id: "default",
    selector: "theme-default",
    key: "settings.appearance.themes.default",
  },
  {
    id: "classic",
    selector: "theme-classic",
    key: "settings.appearance.themes.classic",
  },
  {
    id: "blue",
    selector: "theme-blue",
    key: "settings.appearance.themes.blue",
  },
  {
    id: "teal",
    selector: "theme-teal",
    key: "settings.appearance.themes.teal",
  },
  {
    id: "red",
    selector: "theme-red",
    key: "settings.appearance.themes.red",
  },
  {
    id: "gray",
    selector: "theme-gray",
    key: "settings.appearance.themes.gray",
  },
  {
    id: "green",
    selector: "theme-green",
    key: "settings.appearance.themes.green",
  },
  {
    id: "forest",
    selector: "theme-forest",
    key: "settings.appearance.themes.forest",
  },
  {
    id: "autumn",
    selector: "theme-autumn",
    key: "settings.appearance.themes.autumn",
  },
  {
    id: "frost",
    selector: "theme-frost",
    key: "settings.appearance.themes.frost",
  },
  {
    id: "mocha",
    selector: "theme-mocha",
    key: "settings.appearance.themes.mocha",
  },
  {
    id: "pink",
    selector: "theme-pink",
    key: "settings.appearance.themes.pink",
  },
  {
    id: "noir",
    selector: "theme-noir",
    key: "settings.appearance.themes.noir",
  },
  {
    id: "ember",
    selector: "theme-ember",
    key: "settings.appearance.themes.ember",
  },
  {
    id: "acid",
    selector: "theme-acid",
    key: "settings.appearance.themes.acid",
  },
  {
    id: "spark",
    selector: "theme-spark",
    key: "settings.appearance.themes.spark",
  },
  {
    id: "cobalt",
    selector: "theme-cobalt",
    key: "settings.appearance.themes.cobalt",
  },
  {
    id: "grape",
    selector: "theme-grape",
    key: "settings.appearance.themes.grape",
  },
  {
    id: "spiderman",
    selector: "theme-spiderman",
    key: "settings.appearance.themes.spiderman",
  },
  {
    id: "wolverine",
    selector: "theme-wolverine",
    key: "settings.appearance.themes.wolverine",
  },
  {
    id: "hulk",
    selector: "theme-hulk",
    key: "settings.appearance.themes.hulk",
  },
  {
    id: "popsicle",
    selector: "theme-popsicle",
    key: "settings.appearance.themes.popsicle",
  },
  {
    id: "christmas",
    selector: "theme-christmas",
    key: "settings.appearance.themes.christmas",
  },
  {
    id: "custom",
    selector: "theme-custom",
    key: "settings.appearance.themes.custom",
  },
];

export function ThemePreview(props: {
  selector?: string;
  active?: boolean;
  inUse?: boolean;
  name: string;
  onClick?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      aria-label={`Use ${props.name} theme`}
      aria-pressed={Boolean(props.active)}
      className={classNames(
        props.selector,
        "w-full text-left cursor-pointer group tabbable rounded-lg",
      )}
      onClick={props.onClick}
    >
      {/* Little card thing */}
      <div
        className={classNames(
          "tabbable scroll-mt-32 w-full h-32 relative rounded-lg border bg-gradient-to-br from-themePreview-primary/20 to-themePreview-secondary/10 bg-clip-content transition-colors duration-150",
          props.active
            ? "border-themePreview-primary"
            : "border-transparent group-hover:border-white/20",
        )}
      >
        {/* Dots */}
        <div className="absolute top-2 left-2">
          <div className="h-5 w-5 bg-themePreview-primary rounded-full" />
          <div className="h-5 w-5 bg-themePreview-secondary rounded-full -mt-2" />
        </div>
        {/* Active check */}
        <Icon
          icon={Icons.CHECKMARK}
          className={classNames(
            "absolute top-3 right-3 text-xs text-white transition-opacity duration-150",
            props.active ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Miniature theme preview */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/5 h-4/5 rounded-t-lg -mb-px bg-background-main overflow-hidden">
          <div className="relative w-full h-full">
            {/* Background color */}
            <div className="bg-themePreview-primary/50 w-[130%] h-10 absolute left-1/2 -top-5 blur-xl transform -translate-x-1/2 rounded-[100%]" />
            {/* Navbar */}
            <div className="p-2 flex justify-between items-center">
              <div className="flex space-x-1">
                <div className="bg-themePreview-ghost bg-opacity-10 w-4 h-2 rounded-full" />
                <div className="bg-themePreview-ghost bg-opacity-10 w-2 h-2 rounded-full" />
                <div className="bg-themePreview-ghost bg-opacity-10 w-2 h-2 rounded-full" />
              </div>
              <div className="bg-themePreview-ghost bg-opacity-10 w-2 h-2 rounded-full" />
            </div>
            {/* Hero */}
            <div className="mt-1 flex items-center flex-col gap-1">
              {/* Title and subtitle */}
              <div className="bg-themePreview-ghost bg-opacity-20 w-8 h-0.5 rounded-full" />
              <div className="bg-themePreview-ghost bg-opacity-20 w-6 h-0.5 rounded-full" />
              {/* Search bar */}
              <div className="bg-themePreview-ghost bg-opacity-10 w-16 h-2 mt-1 rounded-full" />
            </div>
            {/* Media grid */}
            <div className="mt-5 px-3">
              {/* Title */}
              <div className="flex gap-1 items-center">
                <div className="bg-themePreview-ghost bg-opacity-20 w-2 h-2 rounded-full" />
                <div className="bg-themePreview-ghost bg-opacity-20 w-8 h-0.5 rounded-full" />
              </div>
              {/* Blocks */}
              <div className="flex w-full gap-1 mt-1">
                <div className="bg-themePreview-ghost bg-opacity-10 w-full h-20 rounded" />
                <div className="bg-themePreview-ghost bg-opacity-10 w-full h-20 rounded" />
                <div className="bg-themePreview-ghost bg-opacity-10 w-full h-20 rounded" />
                <div className="bg-themePreview-ghost bg-opacity-10 w-full h-20 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-between items-center">
        <span className="font-medium text-white">{props.name}</span>
        <span
          className={classNames(
            "inline-block px-3 py-1 leading-tight text-sm transition-opacity duration-150 rounded-full bg-pill-activeBackground text-white/85",
            props.inUse ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          {t("settings.appearance.activeTheme")}
        </span>
      </div>
    </button>
  );
}
