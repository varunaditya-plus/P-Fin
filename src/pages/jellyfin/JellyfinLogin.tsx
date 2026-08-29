import { FormEvent, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate } from "react-router-dom";

import { loginJellyfin } from "@/backend/jellyfin/client";
import { authenticateSeerr, logoutSeerr } from "@/backend/seerr/api";
import { Button } from "@/components/buttons/Button";
import { LargeCard, LargeCardText } from "@/components/layout/LargeCard";
import { AuthInputBox } from "@/components/text-inputs/AuthInputBox";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import { useJellyfinAuth } from "@/stores/jellyfin";

export function JellyfinLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError(undefined);
    try {
      const session = await loginJellyfin(username.trim(), password, false);
      // Clear any previous user's Seerr session before connecting this account.
      await logoutSeerr().catch(() => undefined);
      await authenticateSeerr(username.trim(), password).catch(() => undefined);
      useJellyfinAuth.getState().setSession(session);
      setPassword("");
      const from = (location.state as { from?: string } | null)?.from;
      navigate(
        from?.startsWith("/") && !from.startsWith("//") && from !== "/login"
          ? from
          : "/",
        { replace: true },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to Jellyfin. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubPageLayout>
      <Helmet>
        <title>Sign in · P-Stream</title>
      </Helmet>
      <div className="px-4">
        <LargeCard>
          <LargeCardText title="Sign in to Jellyfin">
            Watch movies and shows from your library.
          </LargeCardText>
          <form className="space-y-6" onSubmit={submit}>
            <AuthInputBox
              label="Username"
              name="username"
              autoComplete="username"
              placeholder="Jellyfin username"
              value={username}
              onChange={setUsername}
            />
            <AuthInputBox
              label="Password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              passwordToggleable
              value={password}
              onChange={setPassword}
            />
            {error ? (
              <p role="alert" className="text-type-danger">
                {error}
              </p>
            ) : null}
            <Button
              theme="purple"
              className="w-full"
              loading={busy}
              disabled={busy || !username.trim() || !password}
              onClick={() => {
                submit();
              }}
            >
              Sign in
            </Button>
          </form>
        </LargeCard>
      </div>
    </SubPageLayout>
  );
}
