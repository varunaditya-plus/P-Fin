import { useEffect, useRef, useState } from "react";

import { integrationIdentity } from "@/backend/integrations/library";
import {
  SimklDeviceCode,
  SimklError,
  disconnectSimkl,
  pollSimklConnection,
  startSimklConnection,
} from "@/backend/integrations/simkl";
import {
  SimklSyncMode,
  SimklSyncPlan,
  applySimklSync,
  previewSimklSync,
} from "@/backend/integrations/simklSync";
import { Button } from "@/components/buttons/Button";
import { SettingsCard } from "@/components/layout/SettingsCard";
import {
  useSimklConnection,
  useSimklPreferences,
} from "@/stores/integrations/simkl";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { homePreferenceScope } from "@/stores/jellyfin/home";

const labels: Record<SimklSyncMode, string> = {
  "import-watchlist": "Simkl Plan to Watch → your watchlist",
  "export-watchlist": "Your watchlist → Simkl Plan to Watch",
  "import-watched": "Simkl watched → Jellyfin",
  "export-watched": "Jellyfin watched → Simkl",
};
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const aborted = () => {
      clearTimeout(timer);
      reject(new DOMException("Stopped", "AbortError"));
    };
    timer = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, ms);
    signal.addEventListener("abort", aborted, { once: true });
  });
}

export function SimklSettings() {
  const connection = useSimklConnection((state) => state.connection);
  const session = useJellyfinAuth((state) => state.session);
  const scope = homePreferenceScope(session);
  const clientId = useSimklPreferences((state) => state.profiles[scope]) ?? "";
  const setClientId = (value: string) =>
    useSimklPreferences.getState().setClientId(scope, value);
  const [device, setDevice] =
    useState<Pick<SimklDeviceCode, "user_code" | "verification_uri">>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<SimklSyncMode>("import-watchlist");
  const [plan, setPlan] = useState<SimklSyncPlan>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<{ title: string; reason: string }[]>(
    [],
  );
  const [limit, setLimit] = useState(50);
  const controller = useRef<AbortController>();
  useEffect(() => {
    setPlan(undefined);
    setDevice(undefined);
    setStatus("");
    setError("");
    setBusy(false);
    setFailures([]);
    return () => controller.current?.abort();
  }, [session?.serverUrl, session?.userId, session?.accessToken]);
  const cancel = () => {
    controller.current?.abort();
    setBusy(false);
    setDevice(undefined);
    setPlan(undefined);
    setStatus(
      "Stopped. Completed changes are retained; preview again before retrying.",
    );
  };
  const connect = async () => {
    if (busy) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const identity = integrationIdentity();
      const deviceCode = await startSimklConnection(
        clientId.trim(),
        run.signal,
      );
      const url = new URL(
        deviceCode.verification_uri_complete ?? deviceCode.verification_uri,
      );
      if (url.protocol !== "https:" || url.hostname !== "simkl.com")
        throw new Error("Simkl returned an invalid approval link.");
      setDevice({
        user_code: deviceCode.user_code,
        verification_uri: url.toString(),
      });
      const deadline = Date.now() + Math.min(deviceCode.expires_in, 900) * 1000;
      let interval = Math.max(deviceCode.interval, 5) * 1000;
      while (Date.now() < deadline && !run.signal.aborted) {
        await wait(interval, run.signal);
        if (Date.now() >= deadline) break;
        try {
          await pollSimklConnection(
            clientId.trim(),
            deviceCode.device_code,
            identity,
            run.signal,
          );
          setDevice(undefined);
          setStatus(
            "Connected. Choose a sync direction and preview the changes.",
          );
          return;
        } catch (reason) {
          if (
            reason instanceof SimklError &&
            reason.code === "authorization_pending"
          )
            continue;
          if (reason instanceof SimklError && reason.code === "slow_down") {
            interval += 5000;
            continue;
          }
          throw reason;
        }
      }
      throw new Error("Simkl approval expired. Start again to get a new code.");
    } catch (reason) {
      if (!run.signal.aborted) {
        setError(
          reason instanceof Error ? reason.message : "Unable to connect Simkl.",
        );
        setDevice(undefined);
      }
    } finally {
      if (!run.signal.aborted) setBusy(false);
    }
  };
  const preview = async () => {
    if (busy) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setError("");
    setFailures([]);
    setPlan(undefined);
    setStatus("Reading your libraries and matching provider IDs…");
    try {
      const next = await previewSimklSync(mode, run.signal);
      if (run.signal.aborted) return;
      setPlan(next);
      setSelected(new Set(next.rows.map((row) => row.key)));
      setLimit(50);
      setStatus(
        `${next.rows.length} changes ready to review. ${next.skipped.length} entries skipped.`,
      );
    } catch (reason) {
      if (!run.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : "Unable to preview sync.",
        );
    } finally {
      if (!run.signal.aborted) setBusy(false);
    }
  };
  const apply = async () => {
    if (!plan || busy) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setError("");
    setFailures([]);
    try {
      const result = await applySimklSync(
        plan,
        selected,
        run.signal,
        (count) => {
          if (!run.signal.aborted)
            setStatus(
              `Processed ${count} of ${selected.size} selected changes…`,
            );
        },
      );
      if (run.signal.aborted) return;
      setStatus(
        `${result.applied} changes applied; ${result.failures.length} failed. Preview again to review remaining changes.`,
      );
      setFailures(result.failures);
      setPlan(undefined);
    } catch (reason) {
      if (!run.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : "Sync interrupted.",
        );
    } finally {
      if (!run.signal.aborted) setBusy(false);
    }
  };
  return (
    <SettingsCard className="space-y-4 h-full">
      <h2 className="font-bold text-xl text-white">Simkl</h2>
      <p className="text-sm text-type-secondary">
        Import or export your watchlist and watched state. Preview the changes
        before applying them.
      </p>
      {!connection ? (
        <div className="space-y-4">
          <details className="rounded-lg bg-black/10 px-4 py-3 text-sm text-type-secondary">
            <summary className="tabbable cursor-pointer font-medium text-white">
              Set up your Simkl application
            </summary>
            <p className="mt-3">
              Create a public <strong className="text-white">AUTH V2</strong>{" "}
              app in{" "}
              <a
                href="https://simkl.com/settings/developer/"
                target="_blank"
                rel="noreferrer"
                className="text-white underline"
              >
                Simkl developer settings
              </a>
              . Choose{" "}
              <strong className="text-white">
                TV, devices &amp; command line
              </strong>{" "}
              or{" "}
              <strong className="text-white">
                Mobile, desktop &amp; browser apps
              </strong>
              , then paste its client ID. No application secret is needed.{" "}
              <a
                href="https://api.simkl.org/api-reference/oauth2-device"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Setup guide
              </a>
            </p>
          </details>
          <label className="block">
            Public application client ID
            <input
              aria-label="Simkl client ID"
              autoComplete="off"
              className="mt-2 block w-full rounded-lg bg-background-secondary p-3 text-white tabbable"
              value={clientId}
              disabled={busy}
              onChange={(event) => setClientId(event.target.value)}
            />
          </label>
          <Button
            theme="purple"
            disabled={busy || !clientId.trim()}
            onClick={connect}
          >
            Connect Simkl
          </Button>
          {device ? (
            <div className="space-y-3 rounded-xl border border-settings-card-border/60 bg-black/20 p-4">
              <p>
                Approve this connection on Simkl. Code:{" "}
                <strong className="mt-2 block font-mono text-2xl tracking-widest text-white">
                  {device.user_code}
                </strong>
              </p>
              <Button theme="purple" href={device.verification_uri}>
                Open Simkl approval
              </Button>
              <p>Waiting for approval. This code expires after 15 minutes.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              Connected as{" "}
              <strong className="text-white">{connection.profile.name}</strong>{" "}
              for {session?.userName}.
            </p>
            <Button
              theme="secondary"
              disabled={busy}
              onClick={async () => {
                controller.current?.abort();
                setPlan(undefined);
                try {
                  await disconnectSimkl();
                  setStatus("Disconnected from Simkl.");
                } catch {
                  setError(
                    "Disconnected locally. Simkl could not be reached to revoke access; remove the app in Simkl Connected Apps if needed.",
                  );
                }
              }}
            >
              Disconnect
            </Button>
          </div>
          <p className="text-sm">
            This connection stays in memory for this page session. Reloading or
            signing out disconnects it. Tokens are excluded from settings
            exports.
          </p>
          <label className="block">
            Sync direction
            <select
              aria-label="Simkl sync direction"
              disabled={busy}
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as SimklSyncMode);
                setPlan(undefined);
                setStatus("");
              }}
              className="mt-2 block max-w-full rounded-lg bg-background-secondary p-3 text-white tabbable"
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm">
            Imports add matched entries without removing existing state. Watched
            sync uses films and individually mapped episodes; it does not infer
            whole-series completion. Original watch dates and rewatch counts are
            not transferred.
          </p>
          <Button theme="secondary" disabled={busy} onClick={preview}>
            Preview sync
          </Button>
        </div>
      )}
      {busy ? (
        <Button theme="secondary" onClick={cancel}>
          Stop
        </Button>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-type-secondary">
          {status}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-type-danger"
        >
          {error}
        </p>
      ) : null}
      {plan ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              theme="secondary"
              disabled={busy}
              onClick={() =>
                setSelected(new Set(plan.rows.map((row) => row.key)))
              }
            >
              Select all
            </Button>
            <Button
              theme="secondary"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </Button>
          </div>
          {plan.rows.slice(0, limit).map((row) => (
            <label
              key={row.key}
              className="flex items-center gap-3 rounded-lg bg-dropdown-background p-4"
            >
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.has(row.key)}
                onChange={(event) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(row.key);
                    else next.delete(row.key);
                    return next;
                  })
                }
              />
              <span>
                <span className="block font-bold text-white">{row.title}</span>
                <span className="text-sm">{row.detail}</span>
              </span>
            </label>
          ))}
          {plan.rows.length > limit ? (
            <Button
              theme="secondary"
              onClick={() => setLimit((value) => value + 50)}
            >
              Show more changes
            </Button>
          ) : null}
          {plan.skipped.length ? (
            <details>
              <summary>{plan.skipped.length} skipped entries</summary>
              <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
                {plan.skipped.map((row) => (
                  <li key={`${row.title}:${row.reason}`}>
                    {row.title}: {row.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <Button
            theme="purple"
            disabled={busy || !selected.size}
            onClick={apply}
          >
            Apply {selected.size} selected changes
          </Button>
        </div>
      ) : null}
      {failures.length ? (
        <details open>
          <summary>{failures.length} failed changes</summary>
          <ul>
            {failures.map((failure) => (
              <li key={`${failure.title}:${failure.reason}`}>
                {failure.title}: {failure.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="border-t border-settings-card-border/50 pt-3 text-xs text-type-secondary">
        Jellyfin reports playback. Use your server’s tracking plugin for ongoing
        scrobbling.
      </p>
    </SettingsCard>
  );
}
