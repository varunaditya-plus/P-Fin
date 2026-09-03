# Jellyfin and Seerr conversion

Preserve p-stream's React, Zustand, player, theme, card, carousel, and modal architecture and visual design. The running client must never scrape providers or play non-Jellyfin media.

1. [x] Establish user-scoped Jellyfin authentication, API types, same-origin Jellyfin/Seerr proxies, session restoration and logout. No passwords or server API keys in source.
2. [x] Replace home/search with accessible Jellyfin libraries, continue watching, next up, latest and favourites. Open cards in details modals and support seasons/episodes.
3. [x] Implement Seerr-backed `/discover`, search, detail/availability states and season-aware requests. Resolve available content against the current Jellyfin user's library.
4. [x] Feed Jellyfin direct or transcoded streams to the existing player. Support resume, progress reporting, audio/subtitles, seeking and next episodes without external providers.
5. [x] Restrict reachable navigation/settings to the Jellyfin client and retain existing appearance controls. Provide development and production proxy configuration.
6. [x] Run type checking, focused tests, build and browser checks against the supplied Jellyfin and Seerr instances. Verify desktop/mobile layouts and actual playback. Do not submit a new live media request as a test.

## Validation record

- Initial checkout clean.
- Live Jellyfin reports 12.0.0; Seerr reports 3.4.1.
- Original provider dependency is unavailable (GitHub tarball HTTP 404). Replace with local compatibility types and disabled legacy provider functions; no remote provider runtime is required.

- Live read checks: 99 movies, 13 series; library pagination, artwork, seasons and episode queries succeed.
- Home cards open Jellyfin details without navigating into playback.
- Seerr discovery/search, movie and season request controls, pending status and available-title handoff verified on desktop and mobile.
- Live Jellyfin movie and episode playback, resume and server progress reporting verified.
- Text subtitles render correctly after audio and quality changes. The production player preserves the paused position and selected tracks; live 2 Mbps output is 1280 by 720, and forward/backward seeking and resumed playback work.
- The in-player episode queue changes Better Call Saul S1E2 to S1E3 and starts actual playback (readyState 4, advancing time), then returns to the library successfully.
- Mobile home at 392 CSS pixels has no horizontal overflow; sticky search, literal-percent searches, protected-route login and immediate sign-out verified.
- 41 focused tests pass; TypeScript, ESLint, production build and whitespace checks pass.
- Slow 4K software transcoding was observed on the supplied server. Compatibility conversions are bounded to 1080p (720p at 2 Mbps), with original resolution retained for supported streams and an explicit startup timeout/retry.
- Seerr request payloads, permissions, quota and duplicate-request handling are tested without submitting a new live request.
- Docker deployment is configured but not runtime-tested because the local Docker daemon is unavailable.

## Tailscale, server selection and content controls

1. [x] Diagnose the upstream address change and restore both proxies. Add a runtime-configured server choice, saved servers, public-user selection and manual login without changing P-Stream styling.
2. [x] Remove the app footer and retain the existing navigation and page layouts.
3. [x] Compare the local Jellyfin Vue, Web and server references. Add content information, versions, track selection, chapters, extras and permission-aware metadata, image, subtitle, identification, refresh, download and deletion controls.
4. [x] Add library filters, collections/playlists and server-backed audio, subtitle and next-episode preferences.
5. [x] Finish collection/playlist item management and verify updated preference-selection rules against Jellyfin.
6. [x] Complete regression checks and rebuild the production preview after the final edits.

### Validation in this update

- Both Tailscale upstreams respond. The old preview process retained the original LAN proxy targets; restarting it restored access to Jellyfin and Seerr.
- Production browser checks pass for server connection, Enter-key sign-in, library filters, card-to-modal behaviour and Seerr discovery/request controls.
- Actual episode playback through the new proxy reaches 1920 × 1080, readyState 4 and advancing playback, with no browser errors.
- Real metadata, images, subtitles, chapters and stream information load. Identify search returns Jellyfin provider results. No media deletions, metadata writes, uploads or new Seerr requests were submitted during these checks.
- Server playback preferences load and the save flow succeeds. Login, home and content details fit a 390-pixel viewport without horizontal overflow.
- Local reference repositories are excluded from the app test suite, Vite watcher and Docker build context; their source remains untouched.
- 95 tests pass, including server selection, permission-aware requests, metadata preservation, playlist entry operations, pagination, playback defaults, version/chapter selection and stale-session protection. TypeScript, ESLint and whitespace checks pass.
- The final production build passes and the rebuilt preview restores its session and library. Chapter selection carries the selected version, subtitle choice and exact start ticks into the player.
