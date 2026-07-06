# Architecture

## Overview

Anime in Abyss is a static, client-side web app. No build step, no backend, no framework — plain HTML/CSS/JS served directly from files.

## Structure

```
index.html      Entry point, page markup; loads the MedievalSharp Google Font
css/
  style.css     Global styles (parchment/manuscript theme, MedievalSharp font, custom scrollbars)
js/
  main.js       UI logic (search input handling, zoom/scroll state, result rendering, judgement rendering, abyss marker)
  anilist.js    AniList GraphQL client + tag-weight computation
assets/
  abyss_map.png Made in Abyss map artwork, used as the full-page scroll background (1708x2642)
```

## Current behavior

### Search & niche score

`js/main.js` wires the search input and "Descend" button to an async `handleSearch()`. On submit (click or Enter key):

1. Fetches the searched title via `AniList.fetchAnimeByTitle(title)` (in `js/anilist.js`), in parallel with the (already in-flight, cached-after-first-load) judgement-data promise.
2. If AniList has no match, `fetchAnimeByTitle` returns `null` — the UI shows an error message in `#result-error` instead of a score. (Note: AniList's `Media(search:)` responds with HTTP 404, not `200` + `null`, when nothing matches — `fetchAnimeByTitle` special-cases `res.status === 404` into a `null` return rather than throwing.)
3. On a match, `computeNicheScore(animeTags, weightTags)` takes the matched anime's 10 tags with the highest `rank` (its most-accepted tags), computes `weight * acceptance` for each — where `weight` is that tag's `score` from the top-100-derived weights table (`weightTags`, from `AniList.getJudgementData()`), or `0` if the tag isn't present there, and `acceptance` is that anime's own `rank/100` for the tag (0–1) — and averages those contributions over the number of tags considered (≤10). Tags outside the top 10 are excluded; tags absent from the weights table still appear in the breakdown with weight 0 (and thus 0 contribution).
4. The final score renders in `#result-score`; the per-tag breakdown (name, weight, acceptance, contribution — sorted by contribution descending) renders into `#contributions-table`, revealed via the `#contributions-btn` toggle. The anime's `coverImage.large` (fetched alongside `tags` in `ANIME_BY_TITLE_QUERY`) renders into `#result-cover` next to the title, and is also set as the new marker's `background-image` (see "Abyss map & marker").
5. `placeMarker(entry)` creates a new marker on the map background for this search (see "Abyss map & marker"); the scroll-into-view is deferred until the zoom-out transition finishes (see "Zoom & navigation state").

Each successful search's data (title, score, contributions, cover URL, marker vertical position) is captured in a plain `entry` object rather than overwriting shared globals — this is what lets multiple searches' markers and details coexist (see "Abyss map & marker").

Any unexpected fetch failure (network error, non-404 bad response) is caught and shown as a generic error in `#result-error`, and also surfaced via the global `#error-popup` (see "Error popup").

Key DOM hooks (`index.html`):
- `#anime-input` — text field for anime title
- `#search-btn` — triggers search
- `#result` — output section; populated on search but stays `hidden` until the user clicks **Details** or a marker (see "Zoom & navigation state")
- `#result-header` (flex row) — `#result-text` (title/score/layer/buttons column) beside `#result-cover` (cover art, stretched to match that column's height via `align-self: stretch` + `object-fit: cover`)
- `#result-error` — shown instead of a score on not-found/error (also gated behind `#result`'s hidden state)
- `#contributions-btn` — toggles `#contributions-table` (per-tag score breakdown), hidden until a successful search; mutually exclusive with `#judgement-details-btn` (opening one closes the other)

### Abyss map & marker

The full page uses `assets/abyss_map.png` as a `body` background, sized via `background-size: max(<state-px>, 100vw) auto` per zoom state (see "Zoom & navigation state") — the `max(..., 100vw)` guards against background-color showing through on the sides on viewports wider than the state's base pixel width. `body`'s `min-height` mirrors this: `max(<state-height>px, calc(100vw * 1.5468), 100vh)` (1.5468 is the map image's natural height/width ratio, 2642/1708) so the background never runs out vertically either.

`js/main.js` maps a niche score onto a **fraction** of the map artwork's native height (`markerTopFractionForScore(score)`, in units of `2642px @ 1708px native width`), via 4 fixed anchors — `score 0 → 2328/2642` (deep), `0.25 → 272/2642`, `0.3 → 125/2642`, `1 → 75/2642` (map ceiling, shallowest point). A single low-degree polynomial through all of these doesn't work: secant slopes vary wildly in magnitude between segments, so a polynomial forced through all anchors exactly overshoots/dips between them. Instead this is a **piecewise monotone cubic Hermite spline** (PCHIP/Fritsch-Carlson, `monotoneTangents()` in `js/main.js`), generalized for any number of anchors: endpoints take the adjacent one-sided secant as their tangent, interior anchors take the Fritsch-Butland weighted harmonic mean of their two neighboring secants (or `0` if those secants disagree in sign, to preserve a local extremum there) — this keeps every segment within the Fritsch-Carlson monotonicity bound. The curve passes through every anchor exactly, is strictly decreasing end-to-end (no dip, no clustering — verified numerically), and is C¹-continuous at each join. Scores are clamped to `[0, 1]` before evaluating (the displayed score itself is not clamped). Adding/moving anchors only requires editing `MARKER_ANCHOR_SCORES`/`MARKER_ANCHOR_FRACTIONS` — the tangent math and segment lookup are anchor-count-agnostic.

The resulting fraction is multiplied by `currentBackgroundHeight()` to get the actual `top` px — **not** by the native `2642`. `currentBackgroundHeight()` re-derives the map's *currently rendered* height by checking which zoom-state class `body` carries (`zoomed-in` → `6000px` base, `descending` → `1300px` base, otherwise `1708px` base — mirroring `css/style.css`'s `background-size` rules) and applying the same `max(<state-px>, 100vw)` × native aspect ratio (`2642/1708`) that the CSS uses. This matters because `background-size` isn't 1:1 with the native artwork in every state — e.g. `descending` renders the map *smaller* than native (`1300px` vs `1708px` base) — so a fixed-px anchor would only look correct at one particular scale/viewport width; working in fractions of native height and rescaling to the live render keeps the marker's visual depth consistent with the anchors regardless of zoom state or viewport.

**Markers are per-search, not shared.** `placeMarker(entry)` creates a new `div.abyss-marker` (appended to `body`, `position: absolute` so it resolves against `body`) for every successful search — it is never removed or repositioned by later searches, so every anime you've looked up this session keeps its own marker on the map (cleared only by reloading or closing the tab). The computed `top` is stashed back onto `entry.markerTop` so later code (Details button, see below) can scroll back to it — note this is a one-time snapshot: if the viewport is resized after a marker is placed, that marker's `top` does not get recalculated (matching this app's existing lack of any other resize-reactive JS). Each marker is filled with that search's cover art (`background-image`, `background-size: cover`, cropped into a circle) with a red outline/glow as a fallback-and-accent color, and is clickable — clicking it calls `showResultFor(entry, true)`, populating `#result` with *that* marker's data and scrolling to it, regardless of which search is most recent.

Markers are hidden whenever `body` has the `zoomed-in` or `panning` class — see "Zoom & navigation state" — so they don't clutter the surface view or the zoom transition itself. A newly placed marker also carries its own `.pending` class (`opacity: 0`, not `display: none`) until the post-search scroll settles — it must stay in normal document flow while pending, or the page's `scrollHeight` wouldn't include its position and the scroll-to-marker below could never reach it.

`window.scrollTo`/`waitForScrollEnd` targets are clamped to `maxScrollTop()` (`document.documentElement.scrollHeight - window.innerHeight`) everywhere a marker-derived target is used — a raw `markerTop`-based target can exceed what the page can actually scroll to (depending on the current zoom state's `min-height`), and since `scrollTo` silently clamps to that max itself, an unclamped target would make `waitForScrollEnd`'s convergence check never succeed.

### Zoom & navigation state

`body` carries state classes that drive a CSS `background-size` transition (`transition: background-size 1.4s ease`) to simulate a camera zoom on the `abyss_map.png` background:

- `body.zoomed-in` — the "at the surface, entering a title" state (baked into `index.html`'s initial `<body class="zoomed-in">` so there's no animate-in flash on first paint). Much larger `background-size` and `overflow: hidden` (scroll locked). Applied on page load, on `#anime-input` focus, and by `#back-btn`. All markers are hidden while this class is present.
- `body.descending` — the "results" state, applied by `handleSearch()` when **Descend** is pressed. Smaller `background-size` (zoomed/panned out to reveal deeper layers) and normal scrolling restored.
- `body.panning` — added alongside `descending` and auto-removed via `setTimeout(..., ZOOM_TRANSITION_MS)`; while present, *all* markers are hidden (not just the new one), so nothing pops in mid-pan even if older markers were already revealed from a previous search.

On load, `js/main.js` sets `history.scrollRestoration = 'manual'` and forces `scrollTo(0, 0)` — otherwise the browser can restore a stale scroll position from before a reload while the zoom state resets fresh, desyncing the two.

`handleSearch()` hides `#search` (input + Descend button), `header h1`/`#header-subtitle`, and reveals `#back-btn` (top-left, "🔍 Search") and `#details-btn` (top-right) — both are `hidden` by default and only shown while descending. `#back-btn`'s click handler reverses all of this: re-shows the search UI and header text, hides `#back-btn`/`#details-btn`/`#result`, swaps `descending` back to `zoomed-in`, and scrolls to top — deferring `input.focus()` until that scroll settles (via `waitForScrollEnd`, see below).

`placeMarker(entry)` waits `ZOOM_TRANSITION_MS` (1400ms, matching the CSS transition) before calling `scrollTo`, then polls `window.scrollY` on `requestAnimationFrame` (`waitForScrollEnd`) until it's within 1px of the target for 3 consecutive frames, and only then unhides that marker. This whole sequence (`markerRevealTimeoutId` + `scrollWatchRafId` + `pendingMarkerEl`) is cancellable via `cancelPendingMarkerReveal()`, which `#back-btn` calls so a stale reveal/scroll can't fire after the user's already bailed back to search mode — the in-flight marker is revealed immediately rather than left permanently hidden, so a completed search is never silently lost.

`#result` (the score/breakdown panel, shared across all markers) is populated by `handleSearch()` via `showResultFor(entry, reveal)` but stays `hidden` through the whole descent unless `reveal` is `true`. Two things can reveal it:
- **`#details-btn`** — toggles `#result` open/closed; opening always shows `latestSearchEntry` (the most recent search, tracked separately from whatever's currently displayed) and scrolls to its marker.
- **Clicking any marker** — always opens `#result` with *that* marker's `entry` (setting `currentEntry`, distinct from `latestSearchEntry`) and scrolls to it.

A `document`-level `click` listener closes `#result` on any click outside it, excluding clicks on markers or `#details-btn` (which have their own open logic and would otherwise immediately re-close what they just opened).

### Judgement details (tag weighting)

On page load, `js/main.js` eagerly calls `AniList.getJudgementData()` (defined in `js/anilist.js`) and renders the result into the `#judgement-details` table. `#judgement-details` lives nested inside `#result`, behind its own `#judgement-details-btn` (next to `#contributions-btn`, inside `#result-text`) — opening it hides `#contributions-table` and vice versa (mutually exclusive, like a tab strip). This is the explainability layer for how "niche" is judged — it does not yet feed back into the search result above. Fetching happens regardless of whether the panel is opened, so the table is already populated the moment the user reveals it.

`js/anilist.js` responsibilities:
1. **Fetch** — queries the public AniList GraphQL API (`https://graphql.anilist.co`, no auth) for the top 100 anime by `POPULARITY_DESC`, paginated at 50/page, requesting each anime's `tags { name rank }`. `rank` is AniList's per-media tag relevance (0–100, community/mod-influenced) — used here as "community acceptance" of the tag.
2. **Compute** — for each tag seen across the sample:
   - `avgAcceptance` = sum of `rank` across ALL 100 anime (anime missing the tag count as 0), divided by 100 samples, divided by 100 again to normalize AniList's `rank` (0–100) down to 0–1
   - `score` = `avgAcceptance` — high score means a tag is highly relevant among popular anime, i.e. a strong "mainstream" signal. Low-score tags are candidate niche indicators.
3. **Cache** — result is stored in `localStorage` under `aia_tag_judgement_v2` with a 24h TTL, to avoid re-hitting AniList on every page load.

Key DOM hooks: `#judgement-details-btn` (toggles `#judgement-details.hidden`, closes `#contributions-table`), `#judgement-details` (panel, hidden by default, nested in `#result`), `#judgement-status` (loading/error text), `#tag-table` / `#tag-table-body` (results, hidden until loaded).

### Error popup

`#error-popup` is a fixed, top-centered dismissible popup (styled with the app's dark/tan palette) for surfacing fetch failures that would otherwise be silent or buried in a hidden panel. `showErrorPopup(message)` (`js/main.js`) sets `#error-popup-message` and unhides the popup; `#error-popup-close` hides it again. Triggered from:
- `judgementDataPromise`'s top-level `.catch` (AniList top-100 fetch fails on page load, before any search) — alongside the existing `#judgement-status` text update.
- `handleSearch()`'s `catch` (AniList fetch fails during a search) — alongside the existing `#result-error` text.

### Scrollable tables

`#contributions-table` and `#tag-table` are wrapper `div`s (not the `<table>` itself) with `max-height: 40vh; overflow-y: auto; overscroll-behavior: contain` — the actual `<table class="data-table">` lives inside, keeping its normal `width: 100%` layout. (Setting `display: block` directly on a `<table>` — an earlier approach — breaks its `width: 100%` in most browsers, since the anonymous table box generated for its row/cell children sizes to content instead of the specified width.) `overscroll-behavior: contain` (also set on `#result` itself) stops wheel/trackpad scroll from chaining out to the next scrollable ancestor once an inner scroller hits its boundary — scroll priority follows whichever scrollable element the cursor is over.

## Planned/missing pieces

- `#result-layer` still says "TBD" — no named-layer lookup (e.g. "Layer 3: Great Fault") tied to the marker position yet, just the raw pixel placement
- No tests, no bundler, no package.json yet — added if/when a real data dependency is introduced
- No handling yet for AniList rate limiting (~30 req/min unauthenticated) beyond the localStorage cache

## Conventions

- Keep it static/client-only unless a feature genuinely requires a backend (e.g. hiding an API key).
- One file per concern (`style.css`, `main.js`) until size justifies splitting.
