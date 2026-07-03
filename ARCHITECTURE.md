# Architecture

## Overview

Anime in Abyss is a static, client-side web app. No build step, no backend, no framework — plain HTML/CSS/JS served directly from files.

## Structure

```
index.html      Entry point, page markup
css/
  style.css     Global styles (dark theme)
js/
  main.js       UI logic (search input handling, result rendering)
assets/          Static images/media (currently empty)
```

## Current behavior

`js/main.js` wires the search input and "Descend" button to a `handleSearch()` function. On submit (click or Enter key), it currently renders placeholder text into the `#result` section — the niche-scoring logic itself is not yet implemented.

Key DOM hooks (`index.html`):
- `#anime-input` — text field for anime title
- `#search-btn` — triggers search
- `#result`, `#result-title`, `#result-score`, `#result-layer` — output section, hidden until first search

## Planned/missing pieces

- Niche-score computation (data source TBD — likely an external anime API, e.g. MyAnimeList/AniList/Jikan)
- Mapping of score → Made in Abyss "layer" visualization
- No tests, no bundler, no package.json yet — added if/when a real data dependency is introduced

## Conventions

- Keep it static/client-only unless a feature genuinely requires a backend (e.g. hiding an API key).
- One file per concern (`style.css`, `main.js`) until size justifies splitting.
