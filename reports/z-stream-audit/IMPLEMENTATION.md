# Movie-Fin implementation and validation ledger

Baseline: `9982577`. Implementation completed in ordered feature batches, followed by integration fixes found in code review and browser testing. All commits are local; nothing was pushed.

## Implemented changes

| Phase | Completed work | Main commits |
| --- | --- | --- |
| 1. Player fixes | Single/double-tap arbitration and cleanup; cropped HLS resolution and concrete manual fallback; stable Media Session metadata; delayed pause overlay with logos and episode metadata | `5dfbf9d`, `a74d062`, `267e232`, `bb6617e` |
| 1. Player controls | Controller focus and remapping with Xbox/PlayStation labels and mute; version descriptions and compatible selection recovery; authenticated trickplay; persistent picture controls; optional volume amplification and audio graph cleanup | `764aa12`, `9e76925`, `b84e437`, `a42ae82`, `f1511e0`, `b6460fa` |
| 1. Playback compatibility | Native iOS/fullscreen/PiP caption fallback; season/series shuffle queues; episode search by name, number or S2E3; accessible player button names | `8f3b6f6`, `f17ab59`, `74acca6` |
| 2. Appearance | Named custom themes, independent palettes and hex colours, live responsive previews, editing/deletion, built-in visibility/reset, validation and 30-theme limit | `23acd22` |
| 2. Settings | Grouped settings; keyboard, caption, gesture and performance controls; account/server-scoped Jellyfin preference sync; dirty-edit protection; selective validated import/export; complete registration on direct Settings visits; viewport-aware dropdowns | `8276301`, `27d5289`, `cd094ad` |
| 3. Home | Section order/visibility, grid/carousel, global and per-section density/rows, saved sorting and favourite edit state, final-slot See All, pagination, filter/scroll persistence | `7256215`, `3dc54be` |
| 3. Home navigation | Genre icons and measured expansion with reduced-motion support; search-side expanding discovery shortcut; mobile search/navigation; current Jellyfin recursive genre endpoint | `dc5e6c6`, `3dc54be`, `5e0c12f`, `339db69` |
| 3. Collections | Permission-aware creation and editing, inline creation, multiple memberships, deduplicated drag/drop, playlist reorder, artwork/counts and count refresh | `b4eb216`, `b972f10` |
| 3. History | Whole-result series episode-count sorting; watched/total across all seasons from Jellyfin flags; recent/completed views; confirmed removal from Continue Watching by resetting only the resume position | `b4eb216`, `8b90a78` |
| 4. Discovery | Random library and Seerr picks; language/region/genre/sort filters; URL restoration; visible/active-only carousel fetching; shared cancellable requests and stable caches; independent shuffled Popular Picks rows | `dc5e6c6`, `899906f`, `f0a94bf` |
| 4. Search/people | Article/punctuation/ampersand normalisation; typo and year matching; bounded fallback and collection expansion; quality/year tiebreaks; person biographies and deduplicated library/Seerr filmography | `7256215`, `dc5e6c6`, `ee1ef83` |
| 4. Subtitles | Shared line-height and position controls; encoding fallback; download/parse cancellation and caching; supported TTML regions/timing/styles and native fallback; transcript search/follow/seek; optional configured translation | `30a75a7`, `4242e3b`, `c880b8a` |
| 4. Subtitle alignment | Optional local Whisper playback-audio capture, confidence checks, cancellation/progress, manual fallback/undo; translation originals survive panel closure; automatic offsets and stale results are scoped to track/source/account | `0752570`, `afab121` |
| 5. Taste | Four-level independent ratings, scoped IDs/snapshots/timestamps and sync; edit/remove; My Taste profile and genre visualisation; watched-elsewhere search; separate, refillable movie/TV quiz; genre/mood/franchise preferences | `bd6be9d`, `5c0dd40` |
| 5. Recommendations | Positive/negative/recency/activity/quality scoring; media-type separation; eligibility and diversity; strength and mood rows; default For You for useful signals while preserving explicit choices; varied source-specific heroes | `bd6be9d`, `5c0dd40`, `3dc54be` |
| 6. Cast | Authenticated Jellyfin receiver handoff; local stream/input/report suspension; actionable receiver controls and idle disconnect; correct remote-title/position return and recovery guards | `97ee73c`, `a786d24`, `5ae91cb` |
| 6. SyncPlay | Group creation/join/leave, participants and authenticated invitations; shared queues/actions; clock and drift coordination; buffering/readiness retries; stale-command guards; WebSocket forwarding/authentication; LAN clipboard fallback | `97ee73c`, `95a5b5a`, `a786d24` |
| 6. Downloads | Version filename/size chooser, original-file and stream links, UTF-8 text subtitles, platform help, permission checks, current Jellyfin authentication and modal-safe clipboard fallback | `5e69284`, `a848995` |
| 6. Lists/integrations | Letterboxd CSV parsing/matching/preview, watched import and separate watchlist; optional Simkl device sign-in with memory-only tokens and four manual sync directions; deduplication/capacity and per-type failure handling; Jellyfin-managed Trakt status/setup | `b08bd4a`, `b63405e`, `50a9265`, `a292336` |
| 6. Reliability | Redacted full diagnostics and truthful copy status; accessible error recovery; malformed query safety; update detection, dismissal and explicit activation without forced playback reloads | `a14e40c`, `66e39d3` |

## Deliberate Jellyfin adaptations

- Library, playback and library recommendations use only accessible Jellyfin titles. Seerr remains optional discovery/request metadata. No providers or direct TMDB API key requirement was restored.
- People remain in the existing modal architecture. Episodes play directly and Continue Watching opens their series details.
- Jellyfin collections/playlists/favourites replace upstream bookmark folders. Permission checks apply to real server mutations.
- Jellyfin owns watched completion rules. There is no hardcoded 90% override. Its current API has no independent hide-from-resume flag, so removing a resume entry explicitly confirms resetting its resume position while preserving watched/history fields.
- Current Jellyfin browser negotiation uses direct files and HLS. DASH was assessed and not added as an unused dependency.
- Trakt uses the server plugin as the single scrobbling owner. Simkl sync is manual and previewed; it does not add a second playback reporter. Simkl requires the user's public application client ID and approval.
- Auto-sync is experimental and conservative. It uses playback audio only, not microphone/screen capture. TTML support covers the implemented timing/style/region subset rather than the entire specification. Translation requires a compatible service chosen by the user.

## Automated validation

- Baseline: 192 tests passed.
- Final implementation: **420 tests in 96 files passed** (`pnpm test`).
- **TypeScript passed** (`pnpm typecheck`).
- **ESLint passed** (`pnpm lint`).
- **Production build passed** (`pnpm build`).
- **PWA build passed** (`pnpm build:pwa --outDir /tmp/movie-fin-validation/pwa-dist`). Its service worker installed and activated in Chrome. The speech-model WASM stays outside the precache because it is loaded only on demand.
- Final genre placement follow-up: focused genre test and ESLint passed; production and PWA builds were repeated successfully.
- `git diff --check` passed throughout the final integration checks.
- Existing toolchain notices remain: old Browserslist data, TypeScript version outside the legacy ESLint parser's advertised range, and large bundle chunks. These did not fail validation.

## Live browser validation

Tested the production preview through headless Chrome against the reachable LAN Jellyfin/Seerr endpoints. The Tailscale address was unreachable from this host during testing; no permanent server address was changed.

| Behaviour | Result |
| --- | --- |
| Jellyfin sign-in, optional Seerr onboarding and owned-content home | Passed |
| Continue Watching episode opens series details | Passed |
| Direct playback and manual 2 Mbps HLS transcode | Passed; video decoded and time advanced |
| SyncPlay WebSocket, create/join, shared playback/pause/seek and leave | Passed with two separately authenticated browser/device sessions; temporary group left afterwards |
| Text subtitle loading, transcript search and cue seek | Passed; selected cue sought to its timestamp |
| Experimental ASR playback capture and model execution | Ran successfully; mismatched dialogue was rejected with timing unchanged. Successful real-world offset correction remains unverified |
| Original download authentication | Passed; range request returned HTTP 206 with 1,024 requested bytes |
| Text subtitle download | Passed; browser completed SRT download |
| Mobile details, integration settings and custom-theme preview | Passed viewport checks; no horizontal overflow in inspected states |
| Home grid controls and persistence | Grid capacity/See All rendered and retained through reload; original carousel preference restored after testing |
| Settings server sync | UI reported successful Jellyfin preference sync |
| Home genre rendering and expansion | Passed after switching to Filters2; compact/expanded controls stay within mobile viewport |
| Seerr Popular Picks | Passed; separate populated row loaded from Seerr with no alerts |
| Series progress | Passed; Mr. Robot displayed the server-backed all-season total of 44 episodes |
| PWA update activation | Passed; new build offered an update, explicit Refresh activated it, and another open tab retained its unsaved input without navigation |
| Browser exceptions in exercised flows | None recorded |

The playback checks updated normal resume progress for the played test titles. No test created Seerr requests, imported real external history, deleted media or reset the user's resume entries.

## Remaining external validation limits

- Physical Chromecast receiver, gamepad and iOS native fullscreen/PiP were not available. Their lifecycle/control logic has automated tests, but hardware behaviour is not certified.
- No real Simkl account approval, Trakt plugin authorisation or translation-service call was performed. Configuration, preview, authentication/error handling and source/account isolation have automated coverage.
- No claim of perfect behaviour across every browser/server/plugin combination is made by a clean build or unit suite.
