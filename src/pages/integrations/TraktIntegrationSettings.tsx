import { useEffect, useState } from "react";

import {
  TraktServerStatus,
  getTraktServerStatus,
  traktJellyfinSettingsUrl,
} from "@/backend/integrations/trakt";
import { Button } from "@/components/buttons/Button";
import { JellyfinSession, useJellyfinAuth } from "@/stores/jellyfin";

function statusCopy(status: TraktServerStatus) {
  if (!status.administrator)
    return {
      title: "Administrator check needed",
      description:
        "Jellyfin only lets administrators check the Trakt plugin. Ask your server administrator to link your Jellyfin user and choose your scrobbling and watched-history permissions.",
    };
  if (status.plugin === "missing")
    return {
      title: "Trakt plugin is not installed",
      description:
        "Install Trakt from Jellyfin's plugin catalogue, restart Jellyfin, then select your Jellyfin user in the plugin settings to authorise Trakt.",
    };
  if (status.plugin === "inactive")
    return {
      title:
        status.pluginState === "Restart"
          ? "Jellyfin restart required"
          : "Trakt plugin is not active",
      description: `Check the plugin in Jellyfin before enabling scrobbling. Its reported state is ${status.pluginState ?? "unknown"}.`,
    };
  if (status.authorization === "linked")
    return {
      title: "Account linked in Jellyfin",
      description:
        "The plugin reports a linked Trakt account for your Jellyfin user. Scrobbling, watched-history import and export, and excluded libraries are controlled in Jellyfin. This status does not verify that those options are enabled or that the Trakt token is still valid.",
    };
  if (status.authorization === "unlinked")
    return {
      title: "Your Jellyfin user is not linked",
      description:
        "Open the Trakt plugin settings, select your Jellyfin user and authorise Trakt. Choose whether to scrobble playback and import or export watched history before saving.",
    };
  return {
    title: "Trakt plugin is active",
    description:
      "This server did not return an account-link status. Open the plugin settings to check your Jellyfin user's connection and scrobbling or watched-history permissions.",
  };
}

function TraktAccountSettings({ session }: { session: JellyfinSession }) {
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<TraktServerStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    let active = true;
    setLoading(true);
    setStatus(null);
    setError("");
    getTraktServerStatus(session, controller.signal)
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not check Trakt on this Jellyfin server. The request may have timed out or your account may need administrator access. You can retry below.",
          );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [session, revision]);
  const copy = status ? statusCopy(status) : null;
  const settingsUrl = traktJellyfinSettingsUrl(
    session,
    status?.plugin !== "missing",
  );

  return (
    <section aria-labelledby="trakt-settings-heading" className="space-y-4">
      <div>
        <h2
          id="trakt-settings-heading"
          className="text-xl font-bold text-white"
        >
          Trakt
        </h2>
        <p className="mt-2 text-type-secondary">
          Use Jellyfin&apos;s Trakt plugin to scrobble playback and synchronise
          watched history. Jellyfin manages the connection and sends updates
          from your playback in this client.
        </p>
      </div>
      <div
        className="rounded-lg bg-dropdown-background p-5 space-y-3"
        data-theme-surface
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? <p>Checking your Jellyfin server…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {copy ? (
          <>
            <p className="font-bold text-white">{copy.title}</p>
            <p className="text-sm text-type-secondary">{copy.description}</p>
            {status?.version ? (
              <p className="text-xs text-type-secondary">
                Plugin version {status.version}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {status?.administrator && settingsUrl ? (
          <a
            href={settingsUrl}
            target="_blank"
            rel="noreferrer"
            className="tabbable inline-flex items-center rounded-lg bg-buttons-purple px-5 py-3 font-medium text-white hover:bg-buttons-purpleHover"
          >
            {status.plugin === "missing"
              ? "Open Jellyfin plugins"
              : "Open Trakt settings in Jellyfin"}
          </a>
        ) : null}
        <Button
          theme="secondary"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          Check again
        </Button>
      </div>
      <p className="text-sm text-type-secondary">
        To stop syncing, disable the relevant options or disconnect your user in
        the Jellyfin plugin. No separate Trakt connection is stored in this
        client.
        {status?.administrator && !settingsUrl
          ? " Open your Jellyfin web client and go to Dashboard → Plugins → Trakt."
          : ""}
      </p>
    </section>
  );
}

export function TraktIntegrationSettings() {
  const session = useJellyfinAuth((state) => state.session);
  if (!session) return null;
  return (
    <TraktAccountSettings
      key={JSON.stringify([
        session.serverUrl,
        session.userId,
        session.accessToken,
      ])}
      session={session}
    />
  );
}
