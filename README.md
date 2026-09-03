# P-Stream for Jellyfin

P-Stream's interface and player, connected to Jellyfin for the library and playback and Seerr for discovery and requests.

## Run locally

Requires Node.js 20+ and pnpm 9.14.4.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173`, select the configured server or enter a Jellyfin server address, then sign in. Server addresses are remembered; public users appear when your server exposes them, with manual sign-in available. After Jellyfin accepts the login, choose whether to enable Seerr before entering the library. Skip it, or enter your Seerr server address and sign in with a Jellyfin account or a local Seerr email/password. The app does not automatically forward Jellyfin credentials or require a Seerr administrator API key. You can also enable Seerr later from `/discover`.

The default upstreams are `http://100.64.96.96:8096` (Jellyfin) and `http://100.64.96.96:5055` (Seerr). Copy `example.env` to `.env` to change them. Use base URLs without a trailing slash. Passwords and administrator API keys do not belong in environment files. Jellyfin user tokens are held in session storage; Seerr uses its HttpOnly session cookie. Sign out ends both sessions.

After changing an upstream address, restart `pnpm dev` or `pnpm preview`. A running preview keeps the proxy targets it loaded at startup. Recreate the Docker container after changing its environment. The machine running the proxy must be connected to the server's Tailscale network.

The configured address uses the same-origin proxy. Other saved servers connect directly from the browser and must allow the client's origin; an HTTPS client requires an HTTPS direct server. Seerr setup also uses the same-origin proxy when its address matches `SEERR_URL`. Custom Seerr addresses connect directly and require a reverse proxy that allows this client's origin and credentialed requests; Seerr does not enable cross-origin API access by default. HTTPS clients require HTTPS direct connections. For standard Seerr installations, set `SEERR_URL` and restart the client so the supplied address uses its proxy. Seerr connections are bound to the current Jellyfin login and stored for that browser session; passwords are never stored.

## Features

- Home: continue watching, next up, latest items and favourites; paginated libraries, collections and playlists; sorting and status, genre and year filters; Jellyfin-only search.
- Cards: open details in the original modal style, with seasons, episodes, favourite and watched state, complete media information, chapters, extras and external metadata links.
- Content controls: choose versions, audio and subtitles before playback; manage metadata, images, subtitles and identification; refresh, download, add to collections/playlists, or delete where Jellyfin permissions allow. Destructive actions require confirmation in the app.
- Collections and playlists: remove entries without deleting media, reorder playlist entries, and update playlist names and public/private settings while retaining shared users.
- Playback: the existing player uses Jellyfin-negotiated direct streams or HLS, with resume/progress reporting, track and version selection, quality options and an episode queue. Jellyfin audio, subtitle and next-episode preferences are saved on the server and applied during playback.
- `/discover`: Seerr discovery and search, availability, request permissions/quotas and season-aware requests. Available titles are matched against the current Jellyfin user's accessible library.
- Existing colours, themes, cards, carousel styles and player controls are retained. Provider scraping, external subtitle services, legacy accounts and TMDB API calls are removed.

## Production

```sh
docker compose up --build -d
```

Open `http://localhost:8080`. The included nginx configuration serves the built app and proxies `/jellyfin/` and `/seerr/` to the configured servers, including video range/HLS traffic and Seerr cookies. Set `JELLYFIN_URL` and `SEERR_URL` in `.env` or the container environment when deploying elsewhere.

This is a client with two fixed service proxies. A static-only host needs equivalent reverse-proxy routes; uploading `dist` alone does not provide those connections. If serving the client over HTTPS, keep both service proxies on that same origin.

For a local production-build check, use `pnpm build` then `pnpm preview`; preview includes the same upstream proxies.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Only Jellyfin and Seerr connections are required. The client needs no TMDB API key, streaming-provider account, browser extension, external CORS proxy or separate P-Stream account backend. Seerr supplies discovery metadata; IMDb/TMDB detail links use metadata IDs returned by Jellyfin or Seerr.

`pnpm build:pwa` adds a service worker using the same manifest and icons as the regular build. Optional instance notices use `VITE_BANNER_MESSAGE` and `VITE_BANNER_ID`.

P-Stream remains credited under the existing [MIT licence](LICENSE.md).
