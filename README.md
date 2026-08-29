# P-Stream for Jellyfin

P-Stream's interface and player, connected to Jellyfin for the library and playback and Seerr for discovery and requests.

## Run locally

Requires Node.js 20+ and pnpm 9.14.4.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173` and sign in with your Jellyfin account. The same credentials are used to establish a separate Seerr session. If that fails, `/discover` offers Seerr sign-in without blocking access to Jellyfin.

The default upstreams are `http://192.168.1.170:8096` (Jellyfin) and `http://192.168.1.170:5055` (Seerr). Copy `example.env` to `.env` to change them. Use base URLs without a trailing slash. Passwords and administrator API keys do not belong in environment files. Jellyfin user tokens are held in session storage; Seerr uses its HttpOnly session cookie. Sign out ends both sessions.

## Features

- Home: continue watching, next up, latest items per library and favourites, plus paginated library browsing and Jellyfin-only search.
- Cards: open details in the original modal style, with Jellyfin seasons, episodes, favourite and watched state.
- Playback: the existing P-Stream player uses Jellyfin-negotiated direct streams or HLS, with resume/progress reporting, audio and subtitle selection, quality options and an episode queue.
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
