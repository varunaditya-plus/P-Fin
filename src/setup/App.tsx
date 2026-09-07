import { ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { jellyfinRequest } from "@/backend/jellyfin/client";
import { logoutSeerr } from "@/backend/seerr/api";
import { Button } from "@/components/buttons/Button";
import { Loading } from "@/components/layout/Loading";
import { KeyboardCommandsEditModal } from "@/components/overlays/KeyboardCommandsEditModal";
import { KeyboardCommandsModal } from "@/components/overlays/KeyboardCommandsModal";
import { useGlobalKeyboardEvents } from "@/hooks/useGlobalKeyboardEvents";
import { useOnlineListener } from "@/hooks/usePing";
import { NotFoundPage } from "@/pages/errors/NotFoundPage";
import { HomePage } from "@/pages/HomePage";
import { JellyfinLogin } from "@/pages/jellyfin/JellyfinLogin";
import { Layout } from "@/setup/Layout";
import { AccountPreferencesSync } from "@/stores/appPreferences/AccountPreferencesSync";
import { useClearModalsOnNavigation } from "@/stores/interface/overlayStack";
import { useJellyfinAuth } from "@/stores/jellyfin";
import { LanguageProvider } from "@/stores/language";

const JellyfinPlayerView = lazy(() => import("@/pages/JellyfinPlayerView"));
const JellyfinSettings = lazy(
  () => import("@/pages/jellyfin/JellyfinSettings"),
);
const SeerrDiscover = lazy(() =>
  import("@/pages/discover/SeerrDiscover").then((module) => ({
    default: module.SeerrDiscover,
  })),
);

function Authenticated({ children }: { children: ReactNode }) {
  const session = useJellyfinAuth((state) => state.session);
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [connectionError, setConnectionError] = useState("");
  useEffect(() => {
    if (!session) return;
    let current = true;
    setStatus("loading");
    setConnectionError("");
    jellyfinRequest(`Users/${session.userId}`)
      .then(() => {
        if (current) setStatus("ready");
      })
      .catch((error: unknown) => {
        if (current) {
          setConnectionError(error instanceof Error ? error.message : "");
          setStatus("error");
        }
      });
    return () => {
      current = false;
    };
  }, [session, attempt]);
  if (!session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (status === "loading")
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  if (status === "error")
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-2xl font-bold text-type-emphasis">
          Unable to connect to Jellyfin
        </h1>
        <p role="alert" className="max-w-lg text-type-secondary">
          {connectionError ||
            "Check your server address and connection, then try again."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
          <Button
            theme="secondary"
            onClick={() => {
              logoutSeerr().catch(() => undefined);
              useJellyfinAuth.getState().setSession(null);
            }}
          >
            Change server
          </Button>
        </div>
      </div>
    );
  return children;
}

export default function App() {
  useOnlineListener();
  useGlobalKeyboardEvents();
  useClearModalsOnNavigation();
  const session = useJellyfinAuth((state) => state.session);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const loginTarget =
    from?.startsWith("/") && !from.startsWith("//") && from !== "/login"
      ? from
      : "/";
  return (
    <Layout>
      <AccountPreferencesSync />
      <LanguageProvider />
      <KeyboardCommandsModal id="keyboard-commands" />
      <KeyboardCommandsEditModal id="keyboard-commands-edit" />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loading />
          </div>
        }
      >
        <Routes>
          <Route
            path="/login"
            element={
              session ? (
                <Navigate to={loginTarget} replace />
              ) : (
                <JellyfinLogin />
              )
            }
          />
          <Route
            path="/*"
            element={
              <Authenticated>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/browse/:query?" element={<HomePage />} />
                  <Route path="/discover" element={<SeerrDiscover />} />
                  <Route
                    path="/discover/*"
                    element={<Navigate to="/discover" replace />}
                  />
                  <Route
                    path="/play/:itemId"
                    element={<JellyfinPlayerView />}
                  />
                  <Route path="/settings" element={<JellyfinSettings />} />
                  <Route
                    path="/media/*"
                    element={<Navigate to="/" replace />}
                  />
                  <Route
                    path="/onboarding/*"
                    element={<Navigate to="/" replace />}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Authenticated>
            }
          />
        </Routes>
      </Suspense>
    </Layout>
  );
}
