# P-Stream for Jellyfin

P-Stream's interface and player, connected to Jellyfin for the library and playback and Seerr for discovery and requests.

## Run locally

Requires Node.js 20+ and pnpm 9.14.4.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173`, select the configured server or enter a Jellyfin server address, then sign in. Server addresses are remembered; public users appear when your server exposes them, with manual sign-in available. For the configured server, the same credentials establish a separate Seerr session. If that fails, `/discover` offers Seerr sign-in without blocking access to Jellyfin.

The default upstreams are `http://100.64.96.96:8096` (Jellyfin) and `http://100.64.96.96:5055` (Seerr). Copy `example.env` to `.env` to change them. Use base URLs without a trailing slash. Passwords and administrator API keys do not belong in environment files. Jellyfin user tokens are held in session storage; Seerr uses its HttpOnly session cookie. Sign out ends both sessions.

After changing an upstream address, restart `pnpm dev` or `pnpm preview`. A running preview keeps the proxy targets it loaded at startup. Recreate the Docker container after changing its environment. The machine running the proxy must be connected to the server's Tailscale network.

The configured address uses the same-origin proxy. Other saved servers connect directly from the browser and must allow the client's origin; an HTTPS client requires an HTTPS direct server. Seerr remains associated with the configured server, so discovery is unavailable while signed in to another server.

## Features

- Home: continue watching, next up, latest items and favourites; paginated libraries, collections and playlists; sorting and status, genre and year filters; Jellyfin-only search.
- Cards: open details in the original modal style, with seasons, episodes, favourite and watched state, complete media information, chapters, extras and external metadata links.
- Content controls: choose versions, audio and subtitles before playback; manage metadata, images, subtitles and identification; refresh, download, add to collections/playlists, or delete where Jellyfin permissions allow. Destructive actions require confirmation in the app.
- Collections and playlists: remove entries without deleting media, reorder playlist entries, and update playlist names and public/private settings while retaining shared users.
- Playback: the existing player uses Jellyfin-negotiated direct streams or HLS, with resume/progress reporting, track and version selection, quality options and an episode queue. Jellyfin audio, subtitle and next-episode preferences are saved on the server and applied during playback.
- `/discover`: Seerr discovery and search, availability, request permissions/quotas and season-aware requests. Available titles are matched against the current Jellyfin user's accessible library.
- Existing colours, themes, cards, carousel styles and player controls are retained. Legacy provider routes, account backend syncing and external subtitle scraping are not mounted by this client.

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

The original discontinued provider dependency has been removed. Retained legacy source files compile against a local compatibility module whose provider APIs are disabled. No streaming provider is used by the Jellyfin client.

P-Stream remains credited under the existing [MIT licence](LICENSE.md).
