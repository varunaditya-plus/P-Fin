import { FormEvent, useEffect, useRef, useState } from "react";

import { authenticateSeerr, getSeerrUser } from "@/backend/seerr/api";
import {
  createSeerrConnection,
  getConfiguredSeerrServer,
} from "@/backend/seerr/servers";
import { SeerrUser } from "@/backend/seerr/types";
import { Button } from "@/components/buttons/Button";
import { LargeCard, LargeCardText } from "@/components/layout/LargeCard";
import { AuthInputBox } from "@/components/text-inputs/AuthInputBox";
import { JellyfinSession } from "@/stores/jellyfin";
import {
  SeerrConnection,
  matchesSeerrSession,
  useSeerrConnection,
} from "@/stores/seerr";

export function SeerrSetup({
  session,
  onComplete,
  onSkip,
  initiallyEnabled = false,
}: {
  session: JellyfinSession;
  onComplete: (user: SeerrUser) => void;
  onSkip?: () => void;
  initiallyEnabled?: boolean;
}) {
  const saved = useSeerrConnection((state) => state.connection);
  const previous = matchesSeerrSession(saved, session) ? saved : null;
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [address, setAddress] = useState(previous?.url || "");
  const [configuredAddress, setConfiguredAddress] = useState<string | null>(
    null,
  );
  const [loadingConfiguration, setLoadingConfiguration] = useState(true);
  const [authMethod, setAuthMethod] = useState<SeerrConnection["authMethod"]>(
    previous?.authMethod || "jellyfin",
  );
  const [username, setUsername] = useState(
    previous?.authMethod === "local" ? "" : session.userName,
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const submitting = useRef(false);
  const editedAddress = useRef(false);

  useEffect(() => {
    mounted.current = true;
    getConfiguredSeerrServer().then((value) => {
      if (!mounted.current) return;
      setConfiguredAddress(value);
      setLoadingConfiguration(false);
      if (!editedAddress.current)
        setAddress((current) => current || value || "");
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || loadingConfiguration || !username.trim()) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const connection = createSeerrConnection(
        address,
        configuredAddress,
        authMethod,
        session,
      );
      await authenticateSeerr(username.trim(), password, connection);
      const user = await getSeerrUser(connection);
      if (!mounted.current) return;
      setPassword("");
      useSeerrConnection
        .getState()
        .setConnection({ ...connection, userId: user.id });
      onComplete(user);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not connect to Seerr.",
        );
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <LargeCard>
      <LargeCardText title={enabled ? "Connect to Seerr" : "Enable Seerr?"}>
        {enabled
          ? "Enter your Seerr server address and sign in to discover and request content."
          : "Discover movies and shows beyond your library and request them through Seerr. Jellyfin works without it."}
      </LargeCardText>
      {enabled ? (
        <form onSubmit={submit} className="space-y-6">
          <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
            <AuthInputBox
              label="Seerr server address"
              name="seerr-address"
              autoComplete="url"
              placeholder="http://your-server:5055"
              value={address}
              onChange={(value) => {
                editedAddress.current = true;
                setAddress(value);
              }}
            />
            <label className="block space-y-3 font-bold text-white">
              <span>Sign in with</span>
              <select
                value={authMethod}
                onChange={(event) => {
                  const method = event.target
                    .value as SeerrConnection["authMethod"];
                  setAuthMethod(method);
                  setUsername(method === "jellyfin" ? session.userName : "");
                  setPassword("");
                  setError("");
                }}
                className="w-full rounded-lg bg-authentication-inputBg px-4 py-3 text-search-text font-normal tabbable"
              >
                <option value="jellyfin">Jellyfin account</option>
                <option value="local">Seerr account</option>
              </select>
            </label>
            <AuthInputBox
              label={authMethod === "local" ? "Email" : "Username"}
              name="seerr-username"
              autoComplete="username"
              placeholder={
                authMethod === "local"
                  ? "Seerr email address"
                  : "Jellyfin username"
              }
              value={username}
              onChange={setUsername}
            />
            <AuthInputBox
              label="Password"
              name="seerr-password"
              autoComplete="current-password"
              placeholder="Password"
              passwordToggleable
              value={password}
              onChange={setPassword}
            />
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <Button
            theme="purple"
            type="submit"
            className="w-full"
            loading={busy}
            disabled={
              busy ||
              loadingConfiguration ||
              !address.trim() ||
              !username.trim()
            }
          >
            Connect Seerr
          </Button>
          <Button
            theme="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setEnabled(false);
              setPassword("");
              setError("");
            }}
          >
            Back
          </Button>
        </form>
      ) : (
        <Button
          theme="purple"
          className="w-full"
          onClick={() => setEnabled(true)}
        >
          Enable Seerr
        </Button>
      )}
      {onSkip ? (
        <Button
          theme="secondary"
          className="mt-4 w-full"
          disabled={busy}
          onClick={onSkip}
        >
          Skip for now
        </Button>
      ) : null}
    </LargeCard>
  );
}
