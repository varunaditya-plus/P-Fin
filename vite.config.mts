import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import checker from "vite-plugin-checker";
import path from "path";
import million from "million/compiler";
import { loadEnv, splitVendorChunkPlugin } from "vite";
import { seerrProxyMiddleware } from "./deploy/seerr-proxy.mjs";

import tailwind from "tailwindcss";
import rtl from "postcss-rtlcss";

const captioningPackages = [
  "dompurify",
  "htmlparser2",
  "subsrt-ts",
  "parse5",
  "entities",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const sendServerConfig = (
    _request: IncomingMessage,
    response: ServerResponse,
  ) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.end(
      JSON.stringify({
        jellyfinUrl: env.JELLYFIN_URL || "http://100.64.96.96:8096",
        seerrUrl: env.SEERR_URL || "http://100.64.96.96:5055",
      }),
    );
  };
  const proxy = {
    "/jellyfin": {
      ws: true,
      target: env.JELLYFIN_URL || "http://100.64.96.96:8096",
      changeOrigin: true,
      rewrite: (url: string) => url.replace(/^\/jellyfin/, ""),
    },
  };
  const proxySeerr = seerrProxyMiddleware(
    env.SEERR_URL || "http://100.64.96.96:5055",
  );
  return {
    base: env.VITE_BASE_URL || "/",
    server: {
      host: "0.0.0.0",
      proxy,
      watch: { ignored: ["**/references/**"] },
    },
    preview: { host: "0.0.0.0", proxy },
    plugins: [
      {
        name: "jellyfin-server-config",
        configureServer(server) {
          server.middlewares.use(proxySeerr);
          server.middlewares.use("/server-config.json", sendServerConfig);
        },
        configurePreviewServer(server) {
          server.middlewares.use(proxySeerr);
          server.middlewares.use("/server-config.json", sendServerConfig);
        },
      },
      million.vite({ auto: true, mute: true }),
      react({
        babel: {
          presets: [
            "@babel/preset-typescript",
            [
              "@babel/preset-env",
              {
                modules: false,
                useBuiltIns: "entry",
                corejs: {
                  version: "3.34",
                },
              },
            ],
          ],
        },
      }),
      VitePWA({
        disable: env.VITE_PWA_ENABLED !== "true",
        registerType: "autoUpdate",
        workbox: {
          maximumFileSizeToCacheInBytes: 4000000, // 4mb
          globIgnores: ["!assets/**/*"],
        },
        includeAssets: [
          "favicon.ico",
          "apple-touch-icon.png",
          "safari-pinned-tab.svg",
          "manifest.json",
          "android-chrome-192x192.png",
          "android-chrome-512x512.png",
        ],
        manifest: false,
      }),
      checker({
        overlay: {
          position: "tr",
          initialIsOpen: false,
        },
        typescript: true, // check typescript build errors in dev server
        eslint: {
          // check lint errors in dev server
          lintCommand: "eslint --ext .tsx,.ts src",
          dev: {
            logLevel: ["error"],
          },
        },
      }),
      splitVendorChunkPlugin(),
    ],

    build: {
      sourcemap: mode !== "production",
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (
              id.includes("@sozialhelden+ietf-language-tags") ||
              id.includes("country-language")
            ) {
              return "language-db";
            }
            if (id.includes("hls.js")) {
              return "hls";
            }
            if (id.includes("locales") && !id.includes("en.json")) {
              return "locales";
            }
            if (id.includes("react-dom")) {
              return "react-dom";
            }
            if (id.includes("Icon.tsx")) {
              return "Icons";
            }
            const isCaptioningPackage = captioningPackages.some((packageName) =>
              id.includes(packageName),
            );
            if (isCaptioningPackage) {
              return "caption-parsing";
            }
          },
        },
      },
    },
    css: {
      postcss: {
        plugins: [tailwind(), rtl()],
      },
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@themes": path.resolve(__dirname, "./themes"),
        "@sozialhelden/ietf-language-tags": path.resolve(
          __dirname,
          "./node_modules/@sozialhelden/ietf-language-tags/dist/cjs",
        ),
      },
    },

    test: {
      environment: "jsdom",
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
    },
  };
});
