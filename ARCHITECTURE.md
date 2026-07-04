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
3. On a match, `computeNicheScore(animeTags, weightTags)` takes the matched anime's 10 tags with the highest `rank` (its most-accepted tags), and for every one of those that also appears in the top-100-derived weights table (`weightTags`, from `AniList.getJudgementData()`), adds `weight^2 * acceptance` to the running score, where `weight` is that tag's `score` from the weights table and `acceptance` is that anime's own `rank/100` for the tag (0–1). The weight is squared to amplify the influence of strongly mainstream/niche tags over borderline ones. Tags outside the top 10, or not present in the weights table, are skipped.
4. The final score renders in `#result-score`; the per-tag breakdown (name, weight, acceptance, contribution — sorted by contribution descending) renders into `#contributions-table`, revealed via the `#contributions-btn` toggle. The anime's `coverImage.large` (fetched alongside `tags` in `ANIME_BY_TITLE_QUERY`) renders into `#result-cover` next to the title, and is also set as `#abyss-marker`'s `background-image` (see "Abyss map & marker").
5. `placeMarker(score)` positions `#abyss-marker` on the map background; the scroll-into-view is deferred until the zoom-out transition finishes (see "Zoom & navigation state").

Any unexpected fetch failure (network error, non-404 bad response) is caught and shown as a generic error in `#result-error`.

Key DOM hooks (`index.html`):
- `#anime-input` — text field for anime title
- `#search-btn` — triggers search
- `#result` — output section; populated on search but stays `hidden` until the user clicks **Details** or the marker (see "Zoom & navigation state")
- `#result-header` (flex row) — `#result-text` (title/score/layer/buttons column) beside `#result-cover` (cover art, stretched to match that column's height via `align-self: stretch` + `object-fit: cover`)
- `#result-error` — shown instead of a score on not-found/error (also gated behind `#result`'s hidden state)
- `#contributions-btn` — toggles `#contributions-table` (per-tag score breakdown), hidden until a successful search; mutually exclusive with `#judgement-details-btn` (opening one closes the other)

### Abyss map & marker

The full page uses `assets/abyss_map.png` as a `body` background, sized via `background-size: max(<state-px>, 100vw) auto` per zoom state (see "Zoom & navigation state") — the `max(..., 100vw)` guards against background-color showing through on the sides on viewports wider than the state's base pixel width. `body`'s `min-height` mirrors this: `max(<state-height>px, calc(100vw * 1.5468), 100vh)` (1.5468 is the map image's natural height/width ratio, 2642/1708) so the background never runs out vertically either.

`js/main.js` maps a niche score linearly onto a vertical pixel position on that background, then centers the viewport there:

- `score = 1` → `top: 150px` (shallow, near the surface)
- `score = 0` → `top: 2200px` (deep in the Abyss)
- Linear interpolation in between: `top = 2200 - clamp(score, 0, 1) * (2200 - 150)`. Scores are clamped to `[0, 1]` for placement purposes only (the displayed score itself is not clamped, and can exceed 1 since it's a sum of several tag contributions).

`#abyss-marker` (a `div`, direct child of `body` so its `position: absolute` resolves against `body`) is moved to that `top`. It's filled with the searched anime's cover art (`background-image`, `background-size: cover`, cropped into a circle) with a red outline/glow as a fallback-and-accent color, and is clickable — it reveals `#result` the same way `#details-btn` does. The reveal (`abyssMarker.hidden = false`) and its scroll are both deferred until the zoom-out settles (see next section) — no named-layer labels tying back to specific Made in Abyss layers yet.

### Zoom & navigation state

`body` carries two mutually-exclusive state classes that drive a CSS `background-size` transition (`transition: background-size 1.4s ease`) to simulate a camera zoom on the `abyss_map.png` background:

- `body.zoomed-in` — the "at the surface, entering a title" state (baked into `index.html`'s initial `<body class="zoomed-in">` so there's no animate-in flash on first paint). Much larger `background-size` and `overflow: hidden` (scroll locked). Applied on page load, on `#anime-input` focus, and by `#back-btn`.
- `body.descending` — the "results" state, applied by `handleSearch()` when **Descend** is pressed. Smaller `background-size` (zoomed/panned out to reveal deeper layers) and normal scrolling restored.

On load, `js/main.js` sets `history.scrollRestoration = 'manual'` and forces `scrollTo(0, 0)` — otherwise the browser can restore a stale scroll position from before a reload while the zoom state resets fresh, desyncing the two.

`handleSearch()` hides `#search` (input + Descend button), `header h1`/`#header-subtitle`, and reveals `#back-btn` (top-left, "🔍 Search") and `#details-btn` (top-right) — both are `hidden` by default and only shown while descending. `#back-btn`'s click handler reverses all of this: re-shows the search UI and header text, hides `#back-btn`/`#details-btn`/`#result`/`#abyss-marker`, swaps `descending` back to `zoomed-in`, and scrolls to top — deferring `input.focus()` until that scroll settles (via `waitForScrollEnd`, see below).

`placeMarker(score)` waits `ZOOM_TRANSITION_MS` (1400ms, matching the CSS transition) before calling `scrollTo`, then polls `window.scrollY` on `requestAnimationFrame` (`waitForScrollEnd`) until it's within 1px of the target for 3 consecutive frames, and only then unhides `#abyss-marker`. This whole sequence (`markerRevealTimeoutId` + `scrollWatchRafId`) is cancellable via `cancelPendingMarkerReveal()`, which `#back-btn` calls so a stale reveal/scroll can't fire after the user's already bailed back to search mode.

`#result` (the score/breakdown panel) is populated by `handleSearch()` but stays `hidden` through the whole descent — `#details-btn`'s click handler (or clicking `#abyss-marker`) is what reveals it, so nothing but the map, marker, and the two fixed corner buttons (`#back-btn`, `#details-btn`, both `position: fixed` so they stay onscreen while the page scrolls) is visible until then.

### Judgement details (tag weighting)

On page load, `js/main.js` eagerly calls `AniList.getJudgementData()` (defined in `js/anilist.js`) and renders the result into the `#judgement-details` table. `#judgement-details` lives nested inside `#result`, behind its own `#judgement-details-btn` (next to `#contributions-btn`, inside `#result-text`) — opening it hides `#contributions-table` and vice versa (mutually exclusive, like a tab strip). This is the explainability layer for how "niche" is judged — it does not yet feed back into the search result above. Fetching happens regardless of whether the panel is opened, so the table is already populated the moment the user reveals it.

`js/anilist.js` responsibilities:
1. **Fetch** — queries the public AniList GraphQL API (`https://graphql.anilist.co`, no auth) for the top 100 anime by `POPULARITY_DESC`, paginated at 50/page, requesting each anime's `tags { name rank }`. `rank` is AniList's per-media tag relevance (0–100, community/mod-influenced) — used here as "community acceptance" of the tag.
2. **Compute** — for each tag seen across the sample, all values normalized to a 0–1 scale:
   - `fraction` = (# anime carrying the tag) / 100
   - `avgAcceptance` = mean of `rank` across those anime, divided by 100 (AniList's `rank` is 0–100)
   - `score` = `fraction * avgAcceptance` — high score means a tag is both common *and* highly relevant among popular anime, i.e. a strong "mainstream" signal. Low-score tags are candidate niche indicators.
3. **Cache** — result is stored in `localStorage` under `aia_tag_judgement_v2` with a 24h TTL, to avoid re-hitting AniList on every page load.

Key DOM hooks: `#judgement-details-btn` (toggles `#judgement-details.hidden`, closes `#contributions-table`), `#judgement-details` (panel, hidden by default, nested in `#result`), `#judgement-status` (loading/error text), `#tag-table` / `#tag-table-body` (results, hidden until loaded).

### Scrollable tables

`#contributions-table` and `#tag-table` are wrapper `div`s (not the `<table>` itself) with `max-height: 40vh; overflow-y: auto; overscroll-behavior: contain` — the actual `<table class="data-table">` lives inside, keeping its normal `width: 100%` layout. (Setting `display: block` directly on a `<table>` — an earlier approach — breaks its `width: 100%` in most browsers, since the anonymous table box generated for its row/cell children sizes to content instead of the specified width.) `overscroll-behavior: contain` (also set on `#result` itself) stops wheel/trackpad scroll from chaining out to the next scrollable ancestor once an inner scroller hits its boundary — scroll priority follows whichever scrollable element the cursor is over.

## Planned/missing pieces

- `#result-layer` still says "TBD" — no named-layer lookup (e.g. "Layer 3: Great Fault") tied to the marker position yet, just the raw pixel placement
- No tests, no bundler, no package.json yet — added if/when a real data dependency is introduced
- No handling yet for AniList rate limiting (~30 req/min unauthenticated) beyond the localStorage cache

## Conventions

- Keep it static/client-only unless a feature genuinely requires a backend (e.g. hiding an API key).
- One file per concern (`style.css`, `main.js`) until size justifies splitting.
