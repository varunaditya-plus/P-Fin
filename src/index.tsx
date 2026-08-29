import "@/setup/pwa";
import "core-js/stable";
import "@/assets/css/index.css";

import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";

import { Loading } from "@/components/layout/Loading";
import { ErrorBoundary } from "@/pages/errors/ErrorBoundary";
import App from "@/setup/App";
import { initializeImageFadeIn } from "@/setup/imageFadeIn";
import { ThemeProvider } from "@/stores/theme";

initializeImageFadeIn();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <Suspense fallback={<Loading />}>
          <ThemeProvider applyGlobal>
            <BrowserRouter
              future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
              <App />
            </BrowserRouter>
          </ThemeProvider>
        </Suspense>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
);
