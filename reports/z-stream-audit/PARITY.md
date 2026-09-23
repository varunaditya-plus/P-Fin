# Retained-feature parity review

Baseline: `9b32dc6` (the user's Home reversion). This pass compares retained Movie-Fin features with pstream.cfd's published UI and assets, with the xp-technologies reference used when the published site no longer exposes a feature. No Home additions were restored. Commits are local only.

## Evidence

- Browser inspected pstream.cfd Settings, Appearance and custom theme editing, Discover, title details, cast and episode controls, and the `/dev/video` player playground.
- Published assets inspected: `app-6d19933d.js`, `chunk-9f413d88.js` (settings), `chunk-8ae2bc64.js` (player), `captions-1375d8b7.js`, `icons-6876772b.js`, `file-d9c39be1.css` and `file-b0740e8e.css`.
- The published site identifies itself as 5.5.0. Its implementation differs from the local xp-technologies checkout (`dc3aa587`); a source checkout alone does not establish current live appearance.
- No Taste/person route, active Letterboxd/Simkl settings card, or matching update-toast implementation was found in the downloaded live build. These retained features use the newer reference implementation as their comparison target.
- The live player playground's MP4 sample failed to play during inspection. Its settings menus remained inspectable. Real playback verification uses the user's Jellyfin library.
- Official Seerr source under `references/seerr` supplies the metadata/collection/related-video endpoint contracts. No direct TMDB API dependency or streaming provider was introduced.

## Feature disposition

| Retained feature | Difference found and outcome | Evidence |
| --- | --- | --- |
| Theme gallery | Replaced a simple grid with the bounded, fading gallery, active-tile positioning, hide/edit actions and keyboard-operable tiles. | Published settings UI/JS |
| Theme builder | Two-column modal, native colour pickers, preset swatches, split secondary/background colours, detailed wireframe preview and persistent Save/Cancel. Preview colours affect the app temporarily; cancelling restores the selected theme. Saved hex colours reopen correctly. | Published settings UI/JS/CSS |
| Settings navigation | Added category sidebar, settings search and category URL support. Hidden categories retain mounted control state. | Published settings UI/JS |
| Preference groups | Compact grouped rows, whole-row switches and shared language selector. Existing Jellyfin settings and subtitle controls remain. | Published settings UI/JS |
| Keyboard guide/editor | Compact badges, category labels, two-column guide and modal surface. Fixed discarded drafts reappearing, inaccessible edit badges, inaccurate cleared-key guidance and category-link navigation. | Published app JS |
| Controller editor | Modal with grouped button badges, Xbox/PlayStation labels, draft Save/Cancel/reset. Controller inputs target active dialogs instead of operating background playback. | Published app JS |
| Playback speed | Preset buttons and custom numeric editing instead of the plain speed selector. | Published player UI/JS |
| Audio boost | Expandable switch/slider and retained per-title preference and limiter. | Published player UI/JS |
| Picture adjustments | Shared sliders for brightness, contrast, saturation and hue, with reset behaviour and stored preferences. | Published player UI/JS |
| Pause overlay | Compact lower-left title, episode and rating metadata, one-second pause delay and quicker transition. Obeys image-logo preference and hides while seeking. | Published player UI/JS |
| Transcript | Icon search field, timestamp pills, edge gradients, current/upcoming-line following and cue seeking. | Published caption/player JS |
| Translation | Separate named-language page with service configuration, progress, cancel and original-track restoration. Uses the user's configured translation service. | Published caption/player JS; Jellyfin service adaptation |
| Subtitle appearance | Full-width themed preview, Typography/Background/Behaviour cards, live layout controls, letter spacing and corner rounding. Existing values remain valid; native captions retain browser ownership. | Published settings/player UI/JS |
| Subtitle alignment | Existing conservative local audio alignment retained; toggle/spinner presentation updated. No provider captions or remote speech service added. | Retained reference functionality |
| Downloads | Compact file/stream/subtitle rows with format/size, themed source selectors and device help. Added direct access from player settings for the active version. | Published player JS |
| Cast | See player parity ledger for toolbar/status presentation; authenticated Jellyfin transport retained. | Published player JS; Jellyfin adaptation |
| SyncPlay | See player parity ledger for party status, people and group controls; Jellyfin group and queue semantics retained. | Published Watch Party JS; Jellyfin adaptation |
| Discover tabs/filter controls | Reference typography, compact dropdowns, recommendation rows and carousel navigation. Optional Seerr authentication/request handling retained. | Published Discover UI; reference recommendation UI |
| Discover random pick | Expanding dice control and cancellable countdown opens title details. | Reference random control |
| Discover More views | Dedicated URL-addressable paginated grids from row heading/final-card actions, retaining filters and search. | Published Discover UI/JS |
| Ratings | Reference heart/thumb icons and compact interactive capsule. Ratings remain distinct from watched/favourite status. | Reference rating capsule |
| Taste profile | Compact rating rows, genre chart and love/avoid summary, separate movie/show library recommendations. | xp-technologies source; absent from current live routes |
| Taste quiz | Six stages, draft preferences, vertical answers and focus-managed reminder after every 25 actual ratings. | xp-technologies source |
| Cast/crew | Shared 128px circular portraits, director roles, deduplication and desktop carousel controls. | Published details DOM and reference code |
| Person details | Circular portrait, expandable biography, separate deduplicated acting/directing filmographies and owned-library section. | xp-technologies PersonView; existing modal architecture |
| Seerr collections | Collection launcher and sortable collection overlay supplied by Seerr. | Published/reference details and official Seerr source |
| Seerr trailers/similar | Landscape video carousel, focus-managed video overlay and lazily loaded similar-title row. | Published details UI and official Seerr source |
| Provider metadata links | TMDB/IMDb order and staggered entrance with reduced-motion handling. | Published details DOM/reference CSS |
| Import/export | Shared settings surfaces, themed file chooser, selected groups and outcome panels. Credential exclusion and validation retained. | Reference settings presentation |
| Letterboxd | File/count/status cards, matching/import progress, cancellation and completion summary. Existing match review and Jellyfin mutation rules retained. | xp-technologies source |
| Simkl/Trakt | Compact connection cards and expandable setup. No automatic sync or duplicate playback reporter introduced. | xp-technologies source; Jellyfin integration adaptation |
| Update notice | Compact top-centre animated glass toast. Explicit activation/dismissal and playback protection retained. | xp-technologies UpdateNotice |
| Error report | Published dark inset monospace report panel; complete redacted diagnostics, focus and copy handling retained. | Published app JS |
| HLS quality/version recovery, gestures, Media Session, trickplay, native captions | Existing functional mechanisms and regression tests retained; no separate missing visual control identified. | Implementation/source audit |
| Cache, search normalisation and recommendation scoring | Retained where used outside the removed Home additions. Algorithmic behaviour has no independent screen to restyle. | Implementation/source audit |
| Content settings/information, chapters, extras, collection membership, playlists and resume-reset confirmation | Jellyfin-specific capabilities retained with server permissions; upstream bookmarks/providers cannot replace these semantics. | Movie-Fin and Jellyfin source |
| Modal motion/context menus/loading/error states | Existing retained transition/focus frame and card menus reused by new features. No duplicate modal system added for details. Seerr person dialogs now nest correctly for focus and Escape; focused player fields no longer prevent menu dismissal. | Published/reference comparison and local tests |
| Home/search additions and episode progress/finder/shuffle additions | Excluded per the user's explicit removal request. Home source files remain byte-identical to the baseline. | Git diff against `9b32dc6` |

## Validation

Automated checks: **490 tests across 116 files passed**; TypeScript, ESLint and the production build passed. The final mobile width correction also passed all six focused settings/caption tests and the rebuilt production checks. Vite still reports large-chunk advisories for existing language/HLS bundles. No deployment or push was performed.

| Browser check | Observed result |
| --- | --- |
| Theme editor | Desktop two-column layout and phone-sized scrolling with reachable Save/Cancel. Changed presets/custom hex, saved a disposable theme, reopened it, cancelled edits and confirmed the saved colour remained. Restored Default and removed the test theme. |
| Settings and shortcuts | Category links and search work. At a 390px viewport, corrected the implicit grid column and verified main content fits within 313px; caption controls remain reachable without horizontal clipping. Controller editor changes Xbox/PlayStation labels. A cancelled keyboard edit does not replace the saved binding. |
| Caption appearance | Changed letter spacing to 2.5px and rounding to 12px; inspected rendered preview CSS and confirmed both after a reload. Restored the original defaults. |
| Taste quiz | Real library movie and show questions load. Genres/moods and Back retain the draft. Did not finish/save artificial ratings. |
| Discover | Seerr results load; Action filtering, More grids and Load more work (39 deduplicated results after pagination). |
| Details and people | Continue Watching opens Mr. Robot's series modal. Thumbnail watched/settings controls remain. Dune's three-film collection loads and rating sort reorders it. Person focus, biography expansion and Escape-to-parent work. Cast arrow advances actual scroll position. |
| Jellyfin player | Real episode video decoded at 1920px width and advanced. Speed changed to 1.5 and restored to 1; brightness changed actual video CSS and was restored. Transcript search and cue seeking worked. |
| Player menus | Escape from a focused brightness slider closes the menu. Download rows identify the active episode/version. SyncPlay fetches the server and shows its empty group state. Rapid close/reopen passed a repeated browser check plus seven real-component regression cases; an earlier transient empty menu was not reproducible. |
| Restored Home | The four Home/layout/navigation source files are byte-identical to baseline `9b32dc6`. Browser still shows the restored search/carousel layout without the excluded additions. |

Normal playback testing advanced the test episode's Jellyfin resume position. Playback was stopped afterwards. No Seerr content requests, list imports or new external account authorisations were submitted.

### Verification limits

- YouTube trailer metadata, selection, frame mounting and teardown work. Actual embedded playback remained blank from the local app in the in-app browser, even when trying the reference's standard YouTube host and a second trailer. The reference site's trailer did play. An iframe-specific referrer policy fixes the app's missing-origin issue; it did not establish playback here. The standard-host experiment was reverted. This remains an unresolved browser playback check, not a claimed success.
- Physical Chromecast/controller/AirPlay and multi-device SyncPlay were not exercised. Transport/state/UI regression tests passed; real receiver/device behaviour is not inferred from them.
- External translation, speech-model alignment and real Letterboxd/Simkl imports were not run against third-party accounts/services. Their cancellation, validation and state paths were tested locally.
- Features absent from the current live build are explicitly marked as reference-source comparisons. No claim that every older z-stream feature is currently exposed on pstream.cfd.

Detailed area notes: [Settings](PARITY-SETTINGS.md), [Discovery](PARITY-DISCOVERY.md), [Player](PARITY-PLAYER.md).

Screenshots: [Desktop theme editor](parity-screenshots/movie-fin-theme-desktop.png), [Mobile theme editor](parity-screenshots/movie-fin-theme-mobile.png), [Subtitle settings](parity-screenshots/movie-fin-subtitle-settings.png), [Mobile subtitle controls](parity-screenshots/movie-fin-subtitles-mobile.png).

## Local history

Changes are split into 30 conventional single-line feature/fix/test commits after `9b32dc6`, followed by a separate evidence-report commit (31 local commits in total). No commit timestamps were rewritten and nothing was pushed. The protected Home rollback remains intact.
