# Architecture

## Overview

Anime in Abyss is a static, client-side web app. No build step, no backend, no framework — plain HTML/CSS/JS served directly from files.

## Structure

```
index.html      Entry point, page markup
css/
  style.css     Global styles (dark theme)
js/
  main.js       UI logic (search input handling, result rendering, judgement rendering)
  anilist.js    AniList GraphQL client + tag-weight computation
assets/          Static images/media (currently empty)
```

## Current behavior

### Search (placeholder)

`js/main.js` wires the search input and "Descend" button to a `handleSearch()` function. On submit (click or Enter key), it currently renders placeholder text into the `#result` section — the niche-scoring logic itself is not yet implemented.

Key DOM hooks (`index.html`):
- `#anime-input` — text field for anime title
- `#search-btn` — triggers search
- `#result`, `#result-title`, `#result-score`, `#result-layer` — output section, hidden until first search

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

- Wire the per-tag `score` values from `anilist.js` into an actual niche-score computation for the searched anime in `#result`
- Mapping of score → Made in Abyss "layer" visualization
- No tests, no bundler, no package.json yet — added if/when a real data dependency is introduced
- No handling yet for AniList rate limiting (~30 req/min unauthenticated) beyond the localStorage cache

## Conventions

- Keep it static/client-only unless a feature genuinely requires a backend (e.g. hiding an API key).
- One file per concern (`style.css`, `main.js`) until size justifies splitting.
