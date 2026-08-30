import { FormEvent, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate } from "react-router-dom";

import { loginJellyfin } from "@/backend/jellyfin/client";
import {
  JellyfinPublicUser,
  JellyfinServerLogin,
  connectJellyfinServer,
  getConfiguredJellyfinServer,
  getServerLogin,
  serverEndpoint,
} from "@/backend/jellyfin/servers";
import { authenticateSeerr, logoutSeerr } from "@/backend/seerr/api";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { LargeCard, LargeCardText } from "@/components/layout/LargeCard";
import { AuthInputBox } from "@/components/text-inputs/AuthInputBox";
import { SubPageLayout } from "@/pages/layouts/SubPageLayout";
import {
  JellyfinServer,
  useJellyfinAuth,
  useJellyfinServers,
} from "@/stores/jellyfin";

export function JellyfinLogin() {
  const [stage, setStage] = useState<"server" | "users" | "login">("server");
  const [address, setAddress] = useState("");
  const [configuredAddress, setConfiguredAddress] = useState<string | null>(
    null,
  );
  const [server, setServer] = useState<JellyfinServer | null>(null);
  const [serverLogin, setServerLogin] = useState<JellyfinServerLogin>({
    users: [],
  });
  const [selectedUser, setSelectedUser] = useState<JellyfinPublicUser | null>(
    null,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState("");
  const [error, setError] = useState<string>();
  const requestId = useRef(0);
  const mounted = useRef(true);
  const servers = useJellyfinServers((state) => state.servers);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    mounted.current = true;
    getConfiguredJellyfinServer().then((value) => {
      if (mounted.current) setConfiguredAddress(value);
    });
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  async function connect(value: string) {
    if (busy) return;
    requestId.current += 1;
    const request = requestId.current;
    setBusy(true);
    setConnectingAddress(value);
    setError(undefined);
    try {
      const connected = await connectJellyfinServer(value, configuredAddress);
      let login: JellyfinServerLogin;
      try {
        login = await getServerLogin(connected);
      } catch {
        // A server may hide its public user endpoint; manual sign-in still works.
        login = { users: [] };
      }
      if (!mounted.current || request !== requestId.current) return;
      useJellyfinServers.getState().saveServer(connected);
      setServer(connected);
      setServerLogin(login);
      setUsername("");
      setPassword("");
      setSelectedUser(null);
      setStage(login.users.length ? "users" : "login");
    } catch (reason) {
      if (mounted.current && request === requestId.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to connect to Jellyfin.",
        );
    } finally {
      if (mounted.current && request === requestId.current) {
        setBusy(false);
        setConnectingAddress("");
      }
    }
  }

  const changeServer = () => {
    requestId.current += 1;
    setStage("server");
    setSelectedUser(null);
    setPassword("");
    setError(undefined);
    setBusy(false);
    setAddress(server?.url || "");
    useJellyfinServers.getState().selectServer(null);
  };

  async function signIn(name: string, secret: string) {
    if (busy || !name.trim() || !server) return;
    requestId.current += 1;
    const request = requestId.current;
    setBusy(true);
    setError(undefined);
    try {
      useJellyfinServers.getState().selectServer(server);
      const session = await loginJellyfin(name.trim(), secret, false);
      await logoutSeerr().catch(() => undefined);
      // The configured Seerr belongs to the configured Jellyfin server. Never
      // send credentials entered for another server to that unrelated service.
      if (server.apiUrl === "/jellyfin") {
        await authenticateSeerr(name.trim(), secret).catch(() => undefined);
      }
      if (!mounted.current || request !== requestId.current) return;
      useJellyfinAuth.getState().setSession(session);
      setPassword("");
      const from = (location.state as { from?: string } | null)?.from;
      navigate(
        from?.startsWith("/") && !from.startsWith("//") && from !== "/login"
          ? from
          : "/",
        { replace: true },
      );
    } catch (reason) {
      if (mounted.current && request === requestId.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to sign in to Jellyfin.",
        );
    } finally {
      if (mounted.current && request === requestId.current) setBusy(false);
    }
  }

  function chooseUser(user: JellyfinPublicUser) {
    if (busy) return;
    setSelectedUser(user);
    setUsername(user.Name);
    setPassword("");
    setError(undefined);
    if (user.HasPassword === false) signIn(user.Name, "");
    else setStage("login");
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (stage === "server") connect(address);
    else signIn(username, password);
  }

  return (
    <SubPageLayout>
      <Helmet>
        <title>
          {stage === "server" ? "Connect to a server" : "Sign in"} · P-Stream
        </title>
      </Helmet>
      <div className="px-4 pb-12">
        <LargeCard>
          <LargeCardText
            title={
              stage === "server"
                ? servers.length
                  ? "Select a server"
                  : "Add server"
                : stage === "users"
                  ? "Select a user"
                  : selectedUser
                    ? `Sign in as ${selectedUser.Name}`
                    : "Sign in"
            }
          >
            {stage === "server"
              ? "Connect to your Jellyfin server to get started."
              : server?.name}
          </LargeCardText>
          {error ? (
            <p role="alert" className="text-red-400 text-sm mb-6">
              {error}
            </p>
          ) : null}
          {stage === "server" ? (
            <div className="space-y-6">
              {servers.length > 0 ? (
                <div className="space-y-3">
                  {servers.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center gap-2 rounded-xl bg-dropdown-background p-3"
                    >
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => connect(saved.url)}
                        className="flex-1 text-left min-w-0 px-2 py-1 tabbable"
                      >
                        <span className="block font-semibold text-white">
                          {saved.name}
                        </span>
                        <span className="block truncate text-sm text-type-secondary">
                          {saved.url}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        title={`Edit ${saved.name} address`}
                        aria-label={`Edit ${saved.name} address`}
                        onClick={() => {
                          setAddress(saved.url);
                          setError(undefined);
                        }}
                        className="p-2 text-type-secondary hover:text-white"
                      >
                        <Icon icon={Icons.EDIT} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        title={`Forget ${saved.name}`}
                        aria-label={`Forget ${saved.name}`}
                        onClick={() =>
                          useJellyfinServers.getState().removeServer(saved.id)
                        }
                        className="p-2 text-type-secondary hover:text-white"
                      >
                        <Icon icon={Icons.X} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <form className="space-y-6" onSubmit={submit}>
                <AuthInputBox
                  label="Server address"
                  name="server-address"
                  autoComplete="url"
                  placeholder="http://your-server:8096"
                  value={address}
                  onChange={setAddress}
                />
                <Button
                  theme="purple"
                  className="w-full"
                  loading={busy && connectingAddress === address}
                  disabled={busy || !address.trim()}
                  type="submit"
                >
                  Connect
                </Button>
              </form>
              {configuredAddress &&
              !servers.some((saved) => saved.url === configuredAddress) ? (
                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => connect(configuredAddress)}
                    className="w-full text-left rounded-lg py-3 px-4 hover:bg-dropdown-background transition-colors tabbable"
                  >
                    <span className="block text-sm text-white">
                      Use configured server
                    </span>
                    <span className="block text-sm text-type-secondary break-all">
                      {configuredAddress}
                    </span>
                  </button>
                </div>
              ) : null}
              {busy ? (
                <p
                  role="status"
                  className="text-center text-sm text-type-secondary"
                >
                  Connecting to {connectingAddress}…
                </p>
              ) : null}
            </div>
          ) : stage === "users" ? (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-center gap-6">
                {serverLogin.users.map((user) => (
                  <button
                    key={user.Id}
                    type="button"
                    disabled={busy}
                    onClick={() => chooseUser(user)}
                    className="w-28 text-center text-white group tabbable"
                  >
                    <div className="h-24 w-24 mx-auto mb-3 rounded-full bg-dropdown-background overflow-hidden flex items-center justify-center group-hover:bg-dropdown-hoverBackground transition-colors">
                      {user.PrimaryImageTag && server ? (
                        <img
                          src={`${serverEndpoint(server, `Users/${encodeURIComponent(user.Id)}/Images/Primary`)}?tag=${encodeURIComponent(user.PrimaryImageTag)}&width=192`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon
                          icon={Icons.USER}
                          className="text-4xl text-type-secondary"
                        />
                      )}
                    </div>
                    <span className="block break-words">{user.Name}</span>
                  </button>
                ))}
              </div>
              {busy ? (
                <p role="status" className="text-center text-sm">
                  Signing in…
                </p>
              ) : null}
              <Button
                theme="purple"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  setSelectedUser(null);
                  setUsername("");
                  setPassword("");
                  setError(undefined);
                  setStage("login");
                }}
              >
                Manual login
              </Button>
              <Button
                theme="secondary"
                className="w-full"
                disabled={busy}
                onClick={changeServer}
              >
                Change server
              </Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={submit}>
              {!selectedUser ? (
                <AuthInputBox
                  label="Username"
                  name="username"
                  autoComplete="username"
                  placeholder="Jellyfin username"
                  value={username}
                  onChange={setUsername}
                />
              ) : null}
              <AuthInputBox
                label="Password"
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                passwordToggleable
                value={password}
                onChange={setPassword}
              />
              <Button
                theme="purple"
                className="w-full"
                loading={busy}
                disabled={busy || !username.trim()}
                type="submit"
              >
                Sign in
              </Button>
              {serverLogin.users.length > 0 ? (
                <Button
                  theme="secondary"
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    setPassword("");
                    setSelectedUser(null);
                    setError(undefined);
                    setStage("users");
                  }}
                >
                  Change user
                </Button>
              ) : null}
              <Button
                theme="secondary"
                className="w-full"
                disabled={busy}
                onClick={changeServer}
              >
                Change server
              </Button>
            </form>
          )}
          {stage !== "server" && serverLogin.disclaimer ? (
            <p className="text-xs text-type-secondary mt-6 whitespace-pre-wrap">
              {serverLogin.disclaimer}
            </p>
          ) : null}
        </LargeCard>
      </div>
    </SubPageLayout>
  );
}
