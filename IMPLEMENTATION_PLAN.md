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
