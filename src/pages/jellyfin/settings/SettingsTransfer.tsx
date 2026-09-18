import { useRef, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { SettingsCard } from "@/components/layout/SettingsCard";
import { Heading1 } from "@/components/utils/Text";
import {
  exportAppPreferences,
  getAppPreferenceSections,
  importAppPreferences,
} from "@/stores/appPreferences/registry";
import { useAppPreferencesSync } from "@/stores/appPreferences/sync";

import { SettingsFilePicker } from "./SettingsFilePicker";

export function SettingsTransfer() {
  const sync = useAppPreferencesSync();
  const groups = [...getAppPreferenceSections()];
  const [selected, setSelected] = useState(groups.map(([name]) => name));
  const [file, setFile] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const readVersion = useRef(0);
  const exportFile = () => {
    try {
      const blob = new Blob([exportAppPreferences(selected)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "movie-fin-settings.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError("");
      setMessage("Settings exported.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to export settings.",
      );
    }
  };
  return (
    <section className="space-y-5">
      <Heading1 border>Settings and backup</Heading1>
      <p className="text-type-secondary">
        These app preferences belong to your Jellyfin account on this server.
        Changes save on this device and sync through Jellyfin. Playback language
        preferences are managed by Jellyfin separately.
      </p>
      <div className="flex items-center flex-wrap gap-3" aria-live="polite">
        <span>
          {sync.status === "saved"
            ? "Synced with Jellyfin."
            : sync.status === "loading"
              ? "Loading account settings…"
              : sync.status === "pending"
                ? "Saving account settings…"
                : sync.error}
        </span>
        {sync.status === "error" ? (
          <Button theme="secondary" onClick={sync.retry}>
            Retry sync
          </Button>
        ) : null}
      </div>
      <SettingsCard
        className="space-y-5"
        paddingClass="px-5 py-5 sm:px-8 sm:py-6"
      >
        <p className="text-sm text-type-secondary">
          Choose which groups to export or import. Backups contain no passwords,
          login tokens or server addresses.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {groups.map(([name, section]) => (
            <label
              key={name}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-settings-card-border/60 bg-black/10 px-4 py-3 text-white hover:bg-white/[0.03]"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(var(--colors-buttons-purple))]"
                checked={selected.includes(name)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, name]
                      : selected.filter((entry) => entry !== name),
                  )
                }
              />
              {section.label ?? name}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            theme="secondary"
            disabled={!selected.length}
            onClick={exportFile}
          >
            <Icon icon={Icons.DOWNLOAD} className="mr-2" />
            Export selected
          </Button>
          <SettingsFilePicker
            label="Import settings file"
            accept="application/json,.json"
            fileName={fileName}
            onChange={async (event) => {
              readVersion.current += 1;
              const version = readVersion.current;
              const upload = event.target.files?.[0];
              setFile(null);
              setFileName("");
              setError("");
              setMessage("");
              if (!upload) return;
              try {
                if (upload.size > 8 * 1024 * 1024)
                  throw new Error("Choose a settings file smaller than 8 MB.");
                const parsed = JSON.parse(await upload.text());
                if (version !== readVersion.current) return;
                if (
                  parsed?.format !== "movie-fin-settings" ||
                  parsed?.version !== 1
                )
                  throw new Error("Choose a Movie-Fin settings export.");
                setFile(parsed);
                setFileName(upload.name);
              } catch (reason) {
                if (version !== readVersion.current) return;
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Unable to read settings file.",
                );
              }
            }}
          />
        </div>
        {file ? (
          <div className="space-y-3 rounded-xl border border-settings-card-border/60 bg-black/20 p-4">
            <p className="text-sm">
              Import the selected groups from {fileName}? Existing values in
              those groups will be replaced.
            </p>
            <Button
              theme="purple"
              disabled={!selected.length}
              onClick={() => {
                try {
                  importAppPreferences(file, selected);
                  setFile(null);
                  setError("");
                  setMessage("Selected settings imported.");
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Unable to import settings.",
                  );
                }
              }}
            >
              Import selected
            </Button>
          </div>
        ) : null}
        {message ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400"
          >
            <Icon icon={Icons.CHECKMARK} />
            {message}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-type-danger"
          >
            {error}
          </p>
        ) : null}
      </SettingsCard>
    </section>
  );
}
