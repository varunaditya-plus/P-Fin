# Source coverage review: phases 1–5

Reviewed on 27 September 2026 against the implementation ledger, the feature-comparison CSV and the current working tree. This records source coverage, not a claim that every browser, device or external service has been exercised. The original CSV describes the old baseline and has not been rewritten as a completion checklist.

## Refinements identified and resolved

| CSV references | Finding at review | Disposition |
| --- | --- | --- |
| 90–92 | Controller polling used saved mappings but omitted Mute and familiar button names. | Resolved in `9e76925`: remappable Mute restores prior volume; Xbox/PlayStation labels retain numeric positions for unknown controllers. Actual controller hardware remains unverified. |
| 35–38 | Library cards had collection artwork/counts while the separate chooser used text buttons. | Resolved in `b972f10`: chooser artwork, server item counts, accessible drop targets and count refresh are implemented. |
| 44 | `aggregateSeriesLengths` counts all available episodes and sums runtime across all result pages. | Fixed: Series episode count orders by `AvailableEpisodeCount`, retaining total runtime separately. Pagination, both directions and cache reuse have regression coverage. |
| 47 | Per-episode watched actions and authoritative Jellyfin played status exist. | Fixed: details render watched/total and a progress bar across all available seasons. The count uses Jellyfin's `Played` flag, excludes missing/virtual episodes, deduplicates IDs and updates after watched actions. |
| 49 | Jellyfin 12 has no `HideFromResume` field or endpoint. | Adapted to the actual server API: Remove from Continue Watching opens an inline Reset resume point confirmation explaining the effect. The current user's permission-gated user-data patch sends only `PlaybackPositionTicks: 0`; watched state, favourites and play history are preserved. Account-switch, denied-permission and request-body regressions are covered. No live user progress was changed for testing. |
| 71–72 | Discovery originally lacked a separate randomised Popular Picks row. | Resolved in `f0a94bf`: movie and series Popular Picks sample quality-filtered Seerr pages, load when visible, cache by account and offer explicit reshuffle. |
| 82–86 | Library search lacked article stripping, collection expansion and quality/recency tiebreaks. | Resolved in `ee1ef83`: leading articles are ignored, up to two matching Jellyfin collections expand, and tied matches use rating then year. Explicit sequel numbers and requested release years constrain expansion/results. |

## Phase 1: existing interface and playback

| Ledger group | Source evidence | Assessment |
| --- | --- | --- |
| Single/double taps | `components/player/utils/VideoClickTarget.tsx` and its click-arbitration tests | Present; initial ledger entry already recorded its regression tests. |
| HLS selection and cropped 4K | `components/player/display/hlsQuality.ts`, its tests, and the HLS display selection path | Source handles unusual renditions and leaving Auto using a real rendition. |
| Media Session | `components/player/internals/MediaSession.tsx` | Metadata depends on title/artist/poster rather than progress time; action lifecycle is cleaned up. |
| Pause overlay | `components/player/overlays/PauseOverlay.tsx` and its tests | Artwork/logo, shortened metadata and playback-aware timing are present. |
| Picture/audio controls | `components/player/display/videoAppearance.ts`, `components/player/enhancements/`, picture settings | Persisted picture controls and 100–600% Web Audio boost exist with title/account scope and failure handling. Browser audio/CORS limits still need live coverage. |
| Gamepad | `stores/gamepad.ts`, `components/player/jellyfin/GamepadEvents.tsx`, `GamepadSettings.tsx` | Active polling reads saved mappings; focus navigation, bounded held-button repeats, remappable Mute and platform button labels are wired. Physical controller testing remains separate. |
| Versions/recovery | `backend/jellyfin/playbackSelection.ts`, `backend/jellyfin/preferences.ts`, `pages/JellyfinPlayerView.tsx` | Explicit version/track/chapter links are validated. Version changes preserve time and choose compatible remembered tracks. Automatic transcode fallback is bounded, with explicit recovery UI. |
| Trickplay/iOS | `backend/jellyfin/trickplay.ts`, `JellyfinTrickplay.tsx`, native-caption tests and display code | Server trickplay and native-caption/custom-caption separation are present. Physical iOS fullscreen/PiP behaviour is not established by source tests. |
| Shuffle/episode jump | `pages/jellyfin/JellyfinDetailsModal.tsx` | Series/season shuffle exists. The episode search accepts title, number and `S2E3`, switching season for a matching reference; this is a functional jump control rather than the old upstream number popover. |
| DASH assessment | Jellyfin `browserProfile` negotiation and reference `jellyfin-web` browser profiles | Current browser negotiations emit direct files and HLS, not MPD. Adding dash.js without a negotiated DASH stream would add an unused player branch; it has intentionally not been restored. |

## Phase 2: settings and persistence

| Ledger group | Source evidence | Assessment |
| --- | --- | --- |
| Custom themes | `stores/theme/customThemes.ts`, `stores/theme/index.tsx`, `ThemeSettingsSection.tsx` and tests | Names, CRUD, 30-theme limit, three independent palettes/hex values, responsive preview, hidden built-ins and reset are implemented. Hex overrides preserve tonal role differences rather than flattening the palette. |
| Theme transitions/grouping | Theme provider, `JellyfinSettings.tsx`, `SettingRow.tsx` | Theme-only transitions and grouped settings are present. Motion respects reduced-motion preferences. |
| Existing player preferences | `JellyfinSettings.tsx`, `CaptionsPart.tsx` | Native captions, shortcut mapping, hold boost, double-click and performance preferences are exposed. Jellyfin owns its autoplay setting rather than duplicating it as a client preference. |
| Account/server sync | `backend/jellyfin/appSettings.ts`, `stores/appPreferences/sync.ts`, `AccountPreferencesSync.tsx` and tests | Local scopes and DisplayPreferences sync preserve unknown fields, dirty edits and account boundaries; hydration and interrupted saves are guarded. |
| Transfer/selectors | `SettingsTransfer.tsx`, registry validators, `components/form/dropdownPlacement.ts` and tests | Selective import/export validates selected sections. Connections/tokens are excluded. Shared dropdown placement flips/clamps to available viewport space. |

## Phase 3: Home and collection controls

| Ledger group | Source evidence | Assessment |
| --- | --- | --- |
| Layout controls | `HomeLayoutControls.tsx`, `stores/jellyfin/home.ts`, Home preference validator | Order, visibility, global defaults and per-section row/density overrides persist. All sections may be hidden. Rows are limited to 1–10. |
| Grid capacity/overflow | `JellyfinHomeSection.tsx` and new component tests | Measured columns obey per-section rows. An overflowing grid reserves its final slot for See All. |
| Edit state | Home section preferences and `JellyfinHomeSection.tsx` | Favourites grid editing persists and expands the visible grid. Remove performs Jellyfin's actual favourite-membership mutation. It does not hide library, Recent or Next Up results. Collection/playlist removal remains in their permission-gated detail controls. |
| Filters/scroll/sort | `stores/jellyfin/browse.ts`, `HomePage.tsx`, `browseSection.ts` | Per-library filters, section sort and session scroll restore are implemented and account scoped. Grid updates do not add blanket auto-animation that would reorder cards on every render. |
| Genre/search polish | `GenreChips.tsx`, `GenreIcon.tsx`, `genreChips.css`, `HeroPart.tsx`, `DiscoverShortcut.tsx` | Five initial genre chips, retained SVG artwork, scrollable compact row, measured expansion and staggered fades. Closed extra chips are excluded from keyboard navigation. Search-side Discover keeps query context, expands on desktop focus/hover and honours reduced motion. Navigation clusters bound the sticky search width; narrow gaps place it below the navigation. |
| Mobile search/navigation | `SearchBar.tsx`, `Navigation.tsx`, `MobileNavigation.tsx` | Mobile input padding is reduced; the consolidated navigation is retained. The library search no longer shows obsolete TMDB search instructions. |
| Containers | `collections.ts`, `CollectionMembershipEditor.tsx`, detail container controls and `LibraryCollections.tsx` | Inline creation, multiple collection memberships, deduplicated drag/drop, actual membership removal, playlist reorder and chooser artwork/counts are implemented. |
| Series/history semantics | `seriesLength.ts`, `seriesProgress.ts`, `progress.ts`, details and card menus | Whole-result episode-count ordering, all-season watched progress and a confirmed reset-resume action are implemented. Jellyfin owns watched state; upstream's hardcoded 90% completion threshold is deliberately not substituted for the server's configured watched rules. The reset uses Jellyfin's nullable user-data patch rather than inventing an unsupported hide flag. |

## Phase 4: people, search and subtitles

| Ledger group | Source evidence | Assessment |
| --- | --- | --- |
| Random/filter browsing | `backend/seerr/browse.ts`, `backend/seerr/filters.ts`, `SeerrDiscoveryFilters.tsx`, `SeerrDiscover.tsx` | Random picks, fresh page selection, language/region/genre/sort filters, URL restoration and category reset exist. Separate movie/series Popular Picks add quality-filtered sampling and reshuffle. Request creation still requires the request flow. |
| Request efficiency | Shared Seerr request helper and caches, visible-carousel IntersectionObserver, recommendation cache, staged quiz | In-flight discovery/recommendation reuse, visible-tab/carousel gating and active-stage quiz fetches are implemented. Previous recommendation/carousel data remains visible during refresh. A library search cache exists; concurrent identical search deduplication is not currently a separate abstraction. |
| Search ranking | `backend/jellyfin/browse.ts` and tests | Article-insensitive exact/prefix/substring/fuzzy matching, bounded collection expansion and rating/year tie breakers are present. Seerr results remain Seerr's ranking; there is no direct TMDB-key search path. |
| People | `PersonModal.tsx`, Jellyfin/Seerr people APIs | Biography, portrait, department, birth/death information and deduplicated filmography are available when supplied by the chosen services. Presentation is a retained person modal, intentionally consistent with the requested card/modal architecture rather than a separate page. |
| Appearance | Shared subtitle layout controls, subtitle store and tests | Numeric vertical position, line height, common appearance/reset and preview controls exist. |
| Fetch/parse/native | Caption download cache/cancellation, `ttml.ts`, native caption pipeline and tests | Abort/generation checks, encoding fallback, timed regions, overlapping cues, inline styles and native fallback are represented in code/tests. |
| Transcript/translation | `components/player/subtitleTools/TranscriptView.tsx`, translation helpers and tests | Search, current cue following, delay-aware seek, cancellation and optional user-configured translation are present. Original track is retained. Server subtitle providers remain Jellyfin's content actions. |
| Experimental auto-sync | `AutoSync.tsx`, capture/Whisper worker/alignment modules and tests | Optional local playback-audio alignment has progress, cancellation, minimum-confidence checks, manual fallback and undo. It does not request microphone audio. Real playback audio capture and model execution remain browser-dependent live checks. |

## Phase 5: personalisation

| Ledger group | Source evidence | Assessment |
| --- | --- | --- |
| Ratings/storage | `stores/taste`, `RatingCapsule.tsx` and tests | Independent Love/Like/Dislike/Hate ratings, keyboard/outside dismissal, toggle-to-clear, metadata snapshots and timestamps. IDs include media type; per-server/user settings sync remains separate from favourites/watched state. |
| Taste/quiz | `TastePage.tsx`, `TasteQuiz.tsx` and tests | Edit/remove ratings, library/Seerr seen-title search, signed genre summary, optional movie/TV stages, skip/finish and no-repeat refill are present. |
| Recommendation signals | `backend/personalisation/engine.ts`, `catalog.ts` and tests | Positive/negative ratings, recency, vote reliability, viewing activity, favourites, genres, moods and franchises are scored separately for movies/TV. Seerr is the external metadata backend. |
| Eligibility/diversity | Recommendation engine/catalog | Rated, watched and in-progress titles are excluded; episode activity maps to its series. Per-seed limits, weak-vote franchise exclusion, relative strength thirds and genre-based intensity groups exist. |
| Default tab/heroes | `viewPreferences.ts`, `usePersonalRecommendations.ts`, `hero.ts` and tests | New/unset preferences select For You when useful signals exist. Explicit saved true/false choices are preserved. Hero mixes eligible recommendations, popular/quality picks and random choices within the source. Library heroes never substitute unavailable Seerr titles. Active discovery filters keep their filtered banner/feed. |

## Focused validation for this follow-up

- Trakt: 12 API/UI tests passed; targeted ESLint and full TypeScript passed. Read-only installed-plugin/current-user status; no browser secret or second scrobble writer. Server-managed setup is intentional: Trakt's official device-token request schema still requires `client_secret`, and Jellyfin's plugin exposes administrator-only authorisation status without returning credentials.
- Home/personalisation refinement: 16 tests passed across genre chips, grid overflow/removal, layout validation, scoped defaults and hero mixing. Targeted ESLint, TypeScript and `git diff --check` passed at runtime freeze.
- Series/history refinement: 29 tests passed across episode-count sorting, watched progress, detail rendering, context-menu confirmation and permission/account-guarded resume resets. Targeted ESLint, TypeScript and `git diff --check` passed. Server contract verified against `references/jellyfin/Jellyfin.Api/Controllers/ItemsController.cs`, `RequestHelpers.AssertCanUpdateUser`, `UpdateUserItemDataDto` and `UserDataManager.SaveUserData`; no live progress mutation was performed.
- No live browser, hardware or external-service completion is inferred from those checks. Parent owns consolidated checks and live review.
