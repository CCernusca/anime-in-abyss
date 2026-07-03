# Architecture

## Overview

Anime in Abyss is a static, client-side web app. No build step, no backend, no framework — plain HTML/CSS/JS served directly from files.

## Structure

```
index.html      Entry point, page markup
css/
  style.css     Global styles (dark theme)
js/
  main.js       UI logic (search input handling, result rendering, judgement rendering, abyss marker)
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
4. The final score renders in `#result-score`; the per-tag breakdown (name, weight, acceptance, contribution — sorted by contribution descending) renders into `#contributions-table`, revealed via the `#contributions-btn` toggle below the score.
5. `placeMarker(score)` positions `#abyss-marker` on the map background and smooth-scrolls it into view (see "Abyss map & marker" below).

Any unexpected fetch failure (network error, non-404 bad response) is caught and shown as a generic error in `#result-error`.

Key DOM hooks (`index.html`):
- `#anime-input` — text field for anime title
- `#search-btn` — triggers search
- `#result`, `#result-title`, `#result-score`, `#result-layer` — output section, hidden until first search
- `#result-error` — shown instead of a score on not-found/error
- `#contributions-btn` — toggles `#contributions-table` (per-tag score breakdown), hidden until a successful search

### Abyss map & marker

The full page uses `assets/abyss_map.png` as a `body` background at its natural resolution (`background-size: 1708px auto`, no scaling — this keeps pixel math simple/rudimentary). `body` has `min-height: 2642px` (the image's natural height) so the whole map is scrollable.

`js/main.js` maps a niche score linearly onto a vertical pixel position on that background, then centers the viewport there:

- `score = 1` → `top: 150px` (shallow, near the surface)
- `score = 0` → `top: 2200px` (deep in the Abyss)
- Linear interpolation in between: `top = 2200 - clamp(score, 0, 1) * (2200 - 150)`. Scores are clamped to `[0, 1]` for placement purposes only (the displayed score itself is not clamped, and can exceed 1 since it's a sum of several tag contributions).

`#abyss-marker` (a plain `div` styled as a red dot, direct child of `body` so its `position: absolute` resolves against `body`) is moved to that `top` and unhidden; `window.scrollTo({ top: top - viewportHeight/2, behavior: 'smooth' })` then centers it in view. This is a rudimentary marker — no map pins/icons, no layer labels tying back to specific Made in Abyss layers yet.

### Judgement details (tag weighting)

On page load, `js/main.js` eagerly calls `AniList.getJudgementData()` (defined in `js/anilist.js`) and renders the result into the `#judgement-details` table, but the section itself stays `hidden` until the user clicks the **Details** button (top-right of the header). This is the explainability layer for how "niche" is judged — it does not yet feed back into the search result above. Fetching happens regardless of whether the panel is opened, so the table is already populated the moment the user reveals it.

`js/anilist.js` responsibilities:
1. **Fetch** — queries the public AniList GraphQL API (`https://graphql.anilist.co`, no auth) for the top 100 anime by `POPULARITY_DESC`, paginated at 50/page, requesting each anime's `tags { name rank }`. `rank` is AniList's per-media tag relevance (0–100, community/mod-influenced) — used here as "community acceptance" of the tag.
2. **Compute** — for each tag seen across the sample, all values normalized to a 0–1 scale:
   - `fraction` = (# anime carrying the tag) / 100
   - `avgAcceptance` = mean of `rank` across those anime, divided by 100 (AniList's `rank` is 0–100)
   - `score` = `fraction * avgAcceptance` — high score means a tag is both common *and* highly relevant among popular anime, i.e. a strong "mainstream" signal. Low-score tags are candidate niche indicators.
3. **Cache** — result is stored in `localStorage` under `aia_tag_judgement_v2` with a 24h TTL, to avoid re-hitting AniList on every page load.

Key DOM hooks: `#details-btn` (toggles `#judgement-details.hidden`), `#judgement-details` (panel, hidden by default), `#judgement-status` (loading/error text), `#tag-table` / `#tag-table-body` (results, hidden until loaded).

## Planned/missing pieces

- `#result-layer` still says "TBD" — no named-layer lookup (e.g. "Layer 3: Great Fault") tied to the marker position yet, just the raw pixel placement
- No tests, no bundler, no package.json yet — added if/when a real data dependency is introduced
- No handling yet for AniList rate limiting (~30 req/min unauthenticated) beyond the localStorage cache
- Marker positioning assumes the background image is rendered at its natural 1708px width; very narrow viewports will horizontally clip the map

## Conventions

- Keep it static/client-only unless a feature genuinely requires a backend (e.g. hiding an API key).
- One file per concern (`style.css`, `main.js`) until size justifies splitting.
