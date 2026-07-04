# Anime in Abyss

A little webapp that computes a measure of how niche an anime is and visualizes the result using Made in Abyss references (layers of the Abyss).

## Features

- Search for any anime by title (fetched live from AniList) and get a **niche score** for it — the more its tags are common/mainstream among the top 100 most popular anime, the higher the score.
- If no matching anime is found on AniList, you'll get a clear error instead of a broken result.
- The anime's cover art shows up next to its title in the results, and fills the Abyss marker itself (cropped into a red-outlined circle) so you can spot it on the map at a glance.
- Expand **Show tag breakdown** to see exactly which of the anime's tags contributed, and how much each one added.
- The page background is the Made in Abyss map — a higher score drops your marker near the surface, a lower (nichier) score sends it deep into the Abyss, and the page auto-scrolls to show you where you landed once the zoom-out finishes.
- **Every search you make stays on the map** — each one drops its own marker, and none of them disappear when you search again. They're remembered for the rest of your session (reload the page or close the tab to clear them).
- Markers are hidden while you're zoomed in at the surface or while the camera is panning between zoom levels, so they don't clutter the transition.
- **Zoom**: while entering a title, the map is zoomed in tight on the surface and page scroll is locked. Once you press **Descend**, the search box and header hide, the map zooms out to reveal the deeper layers, and the page auto-scrolls to your marker.
- Press the **Search** button (top-left, appears once descended) to come back up: it re-shows the search box, re-zooms in, and re-locks scroll.
- The score/result panel stays hidden while descending — press **Details** (top-right) or click any marker to reveal it, and the page scrolls to that marker's spot. Clicking **Details** again, or clicking anywhere outside the panel, closes it.
- Clicking an older marker shows *its* data in the panel, but **Details** (top-right) always jumps back to your most recent search.
- **Judgement Details** — inside the result panel, click **Judgement Details** (next to **Show tag breakdown** — only one of the two can be open at a time) to see how the judging works generally: the app pulls the top 100 most popular anime from AniList and breaks down every tag they carry into a "mainstream score" (how common the tag is, weighted by how strongly the community says it applies), shown in a table with an explanation of what each column means.

## Usage

Use the [deployed webapp](https://ccernusca.github.io/anime-in-abyss/)

Or:

1. Open `index.html` in a browser (no build step or server required; requires internet access to reach AniList).
2. Type an anime title into the search box (the map zooms in tight on the surface while you type).
3. Press **Descend** (or hit Enter) — the search box and header hide, the map zooms out, and once that settles the page auto-scrolls to your anime's spot on the Abyss map, marked with a cover-art dot.
4. Click **Details** (top-right) or any marker to reveal that anime's niche score, cover art, and tag breakdown/judgement buttons, scrolling you to its marker.
5. Click **Show tag breakdown** or **Judgement Details** to see the data behind the score (only one panel shows at a time).
6. Search again — your previous marker stays put. Click **Search** (top-left) any time to return to the surface and search again, or **Details** to jump back to your latest search.

## Technologies

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details on the project structure.
