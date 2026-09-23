# Settings, integrations and reliability parity review

Reviewed against the published pstream.cfd assets on 28 September 2026 and the local xp-technologies reference. Published assets were inspected from the browser fetches stored under `/tmp/movie-fin-parity/reference-assets`. These temporary files are evidence from this session, not application dependencies.

The deployed application is newer/different than the reference checkout. `chunk-9f413d88.js` is the published settings implementation. `app-6d19933d.js` contains the published error report. Theme builder/gallery changes are tracked by the main parity review, not this file.

| Retained feature | Evidence and comparison | Outcome |
| --- | --- | --- |
| Settings navigation/search | Published settings use a category sidebar with 280px desktop column, fixed search and active-link colours. Movie-Fin previously had an undifferentiated long page. | Added a settings-only category sidebar and search; appearance, playback, subtitles, connections and backups stay available. Section hiding preserves mounted control state. Search width is bounded to avoid colliding with navigation; narrow screens put search in content. No Home navigation changed. |
| Grouped preference rows | Published/reference settings use compact labelled panels, translucent dropdown backgrounds and divided clickable rows. | Reused that grouping and panel treatment, with semantic labelled switches. The whole row activates the switch once. |
| Language selection | Published settings use the themed dropdown. Movie-Fin used a browser-native select. | Interface language now uses the existing shared Dropdown and locale names. Native server playback language selectors remain available with their existing exact Jellyfin values. |
| Appearance organisation | Published settings place appearance controls beside the theme gallery. | Two-column appearance category at wide sizes; existing featured/logo/card/player controls preserved. Removed Home additions were not restored. |
| Controller settings | Published preferences launch a separate controller editor. | Player parity batch supplies the launcher/editor via the existing GamepadSettings component. Settings navigation keeps it under Preferences. |
| Native captions and subtitle appearance | Published settings chunk function rl has a full-width themed preview, Text & Typography / Background & Effects columns and behaviour card. | Matched the published grouping and preview surface, kept fullscreen preview and native-caption hiding semantics, and used shared subtitle state for spacing, rounding and Fix capitals. Player parity owns renderer/store fields and corresponding player controls. |
| Account/server preference sync | Original reference uses the P-Stream settings backend. Movie-Fin uses Jellyfin DisplayPreferences with account scope and dirty-write guards. | Preserved the Jellyfin implementation; sync status/retry remain in backup settings. |
| Selective settings import/export | Movie-Fin supports validated section selection, credential exclusion and explicit import. | Retained behaviour; added reference SettingsCard surfaces, themed file chooser, selectable section tiles and outcome panels. |
| Letterboxd CSV matching/import | No active Letterboxd UI found in downloaded live settings chunk. Reference LetterboxdImportPart has file buttons, selected-file/parsed/status cards, progress and completion panels. | Applied reference presentation. Kept Movie-Fin match preview/correction, Stop, per-account watchlist and permission-aware watched mutations. Added live progress state and cancellation regression coverage. |
| Letterboxd watchlist export | Movie-Fin's separate watchlist is a Jellyfin adaptation rather than P-Stream bookmark groups. | Retained existing CSV export and details/remove controls. No automatic requests or imports added. |
| Simkl connection/sync | Live FAQ still mentions Simkl, but no active card implementation found in downloaded settings chunk. Reference ConnectionsPart uses compact cards. | Compact bordered card and connection action, expandable setup instructions, readable device code and existing preview/apply flows. Public-client device authentication and manual sync preserved. |
| Trakt | Reference connects a separate P-Stream OAuth/scrobbling owner. Movie-Fin intentionally reads the Jellyfin plugin status instead. | Compact card matches reference presentation. Server-managed setup, administrator gating, retry and no duplicate scrobbling preserved. |
| Error diagnostics | Published app uses a padded dark monospace report panel with subtle border. | Matched report-panel framing while preserving complete redacted diagnostics, wrapping, truthful clipboard result, manual-copy fallback, focus trapping and Escape dismissal. |
| Update notification | The current downloaded app bundle does not expose the reference UpdateNotice implementation. The retained feature's reference source is components/UpdateNotice.tsx. | Matched its compact top-centre glass toast, reload badge and slide/fade. Kept Movie-Fin's explicit update activation, per-version dismissal, errors, reduced-motion support and protection against forced playback reloads. |
| Malformed query handling | Functional robustness change with no corresponding visual control. | Preserved. No changes required for appearance. |

## Validation

- Settings category/search/full-row toggle: 3 focused tests passed. Control state survives switching categories.
- Letterboxd, Simkl and Trakt: 14 focused tests passed, including a new component test proving matching progress updates and Stop aborts without applying server changes.
- Update/error paths: 15 focused tests passed; explicit refresh, same-version dismissal, activation error, report copying/failure and accessible modal behaviour remain covered.
- Scoped ESLint passed for all edited files.
- Full TypeScript passed after the final settings/reliability changes.
- Browser comparison and final consolidated validation are recorded by the main task. No external account authorisation or real list import was performed by this batch.

## Keyboard guide/editor follow-up

The deployed application differs materially from the older reference here too. `app-6d19933d.js` contains the compact editor near `global.keyboardShortcuts.title` and the two-column guide near `global.keyboardShortcuts.editInSettings`. Its shared FancyModal uses a rounded, translucent flare surface with an explicit close button.

- Reused the published compact group headings, small key badges, divided editor footer and two-column guide arrangement.
- Preserved local/Jellyfin account preference ownership and locked-key policy.
- Made editable key badges keyboard-operable buttons.
- Fixed cancelled edits remaining in the draft after reopening; a fresh opening now reads current account preferences without replacing an open draft.
- The guide no longer advertises cleared bindings or disabled number-key seeking.
- The settings link explicitly closes the guide. The settings layout now honours and updates category query parameters, including links opened while already on Settings.
- Eight focused tests cover editor save/cancel/reopen, accurate guide content, navigation/category selection, search and retained control state. Scoped lint passed; full TypeScript passed.

## Remaining retained inventory coverage

This review used the complete IMPLEMENTATION.md inventory. The following disposition avoids treating source-only mechanisms as missing visual features.

| Inventory area | Source review/disposition |
| --- | --- |
| Single/double taps, HLS rendition selection, Media Session metadata | Existing event/quality/metadata mechanisms and regression coverage remain. These are behaviour fixes, not independent screens. No visual replacement identified. |
| Pause overlay | Material mismatch found against published player assets, including ignoring the image-logo preference. Sent to player parity owner for the compact published presentation and preference fix. |
| Controller and picture/audio controls | Player parity batches own the controller dialog, sliders and numeric/preset controls. Settings retains their launcher. |
| Version selection/recovery, trickplay, iOS/native caption fallback | Jellyfin-specific data/negotiation and browser capabilities remain authoritative. No provider-selection API or incompatible native-shell feature should be restored for visual similarity. |
| Shuffle, episode finder and watched progress | Explicitly removed by the user. Not restored. |
| All Home layout, shortcuts, recommendation/genre additions | Explicitly excluded. No Home files modified by these settings batches. |
| Collection membership and playlist management | Jellyfin permissions, multiple membership and reorder behaviour remain. Movie-Fin's membership selector is plainer than upstream bookmark-folder icon selection, but folder/group semantics cannot replace real Jellyfin collections. Discovery/modal owner informed for their retained modal review. |
| Continue Watching/history reset | Server-backed reset confirmation remains. It must not be replaced by upstream client-history deletion or a hardcoded completion threshold. |
| Discovery filters, Popular Picks/random, request/cache behaviour | Discovery parity owner covers controls and presentation. Existing Seerr cancellation/cache/account scoping remain. |
| Person details, filmography and cast carousel | Discovery parity owner covers these modal/carousel changes. Existing person view already has separate loading/error/empty and retry states for Jellyfin versus Seerr. |
| Subtitle appearance/transcript/translation/auto-sync | Player parity owner covers presentation. Local caption parsing, native fallback, translation service choice and conservative alignment remain intentional service/browser adaptations. |
| Ratings, taste profile/quiz, recommendations | Discovery parity owner covers the compact capsule, chart/profile and quiz. Recommendation scoring/cache is behaviour, not a separate visual control. Home recommendation additions remain excluded. |
| Google Cast | Found a plainer indicator/settings presentation than published controls. Sent to player parity owner. Receiver transport/authentication must remain Jellyfin-specific. |
| SyncPlay | Found plain comma-separated participants and raw state/ping presentation where published Watch Party uses a status card, status dot, people list and clearer join/create controls. Sent to player parity owner; Jellyfin group permission/queue/authentication semantics remain. |
| Downloads | Found plain standalone sections/native selectors where reference provides original/stream option cards and nested guidance. Player parity owner implements this without restoring third-party download providers. |
| External integrations/settings sync | Detailed in the main table. No real account imports or extra playback reporters were added. |
| Error/update/recovery | Detailed in the main table. Existing malformed-query safeguards stay intact. |
| Loading/empty states | Library details, content extras and person modal have explicit loading, empty, error and retry states. Discovery already uses card skeletons while loading rows and a no-results state. SyncPlay initial loading/group state presentation was the notable gap sent to the player owner. |
| Modal lifecycle | DetailsModalFrame retains final content through exit transitions and supplies focus trapping, Escape/backdrop closing and reduced-motion variants. ContentSettingsModal/ContentInformation expose Jellyfin-only editing and metadata actions; their functionality has no direct P-Stream counterpart and remains preserved. |

## Final caption and regression follow-up

- Subtitle settings now use the deployed 44-unit-high themed preview, two-column typography/background cards and a separate behaviour card. Existing fullscreen expansion and Escape dismissal remain. Native captions still hide custom rendering controls because Jellyfin/browser-native captions have their own rendering semantics.
- Added shared letter-spacing and background-radius controls supplied by the player parity batch, retained line spacing/position/style/border/colour/bold/blur/opacity, and connected Fix capitals to the existing subtitle preference. Reset restores the complete shared appearance and disables when already at defaults. The preview follows the same casing preference. No unsupported ad-filter/spelling backend was introduced.
- Two focused settings tests pass for updating/resetting shared appearance, retaining styles through native-mode changes, Fix capitals and fullscreen preview dismissal. Focused ESLint and full TypeScript pass.
- Independent review identified newly themed dropdowns comparing recreated option objects by reference. The shared Listbox now compares by id; a real Headless UI test fails before the fix and passes after, including selected ARIA state and keyboard reopening at the selected nonfirst item.
- Root browser QA found Escape inert from player range inputs. Escape now closes the routed menu before typing-input suppression, allows a top app modal or Headless dialog to handle it first, and respects events already consumed by controls. Four focused regression tests and four existing Jellyfin input tests pass. Text-input playback shortcuts remain suppressed.
- Independent source review also reported clamped short biographies without an expansion control and new button-based cast/trailer carousels using an anchor-only navigation helper. Those were sent to the discovery parity owner for correction and tests.

## Final mobile verification

The Browser check at 390px found the implicit mobile grid column stretching to 973px because the nonwrapping category strip supplied its minimum width. The layout now declares a bounded single column, allows the sidebar to shrink and constrains its scroll strip. Caption row controls wrap within narrow cards and retain right alignment. Browser readback measured 313px main content within a 390px viewport; preview text and colour/switch controls are reachable. Existing six settings/caption tests and scoped lint pass.
