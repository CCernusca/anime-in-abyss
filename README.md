# Anime in Abyss

A little webapp that computes a measure of how niche an anime is and visualizes the result using Made in Abyss references (layers of the Abyss).

## Features

- Search for any anime by title (fetched live from AniList) and get a **niche score** for it — the more its tags are common/mainstream among the top 100 most popular anime, the higher the score.
- If no matching anime is found on AniList, you'll get a clear error instead of a broken result.
- The anime's cover art shows up next to its title in the results, and fills the Abyss marker itself (cropped into a red-outlined circle) so you can spot it on the map at a glance.
- Expand **Show tag breakdown** to see exactly which of the anime's tags contributed, and how much each one added.
- The page background is the Made in Abyss map — a higher score drops your marker near the surface, a lower (nichier) score sends it deep into the Abyss, and the page auto-scrolls to show you where you landed once the zoom-out finishes.
- **Zoom**: while entering a title, the map is zoomed in tight on the surface and page scroll is locked. Once you press **Descend**, the search box and header hide, the map zooms out to reveal the deeper layers, and the page auto-scrolls to your marker.
- Press the **Search** button (top-left, appears once descended) to come back up: it re-shows the search box, re-zooms in, and re-locks scroll.
- The score/result panel stays hidden while descending — press **Details** (top-right, or click the marker itself) to reveal it.
- **Judgement Details** — inside the result panel, click **Judgement Details** (next to **Show tag breakdown** — only one of the two can be open at a time) to see how the judging works generally: the app pulls the top 100 most popular anime from AniList and breaks down every tag they carry into a "mainstream score" (how common the tag is, weighted by how strongly the community says it applies), shown in a table with an explanation of what each column means.

## Usage

Use the [deployed webapp](https://ccernusca.github.io/anime-in-abyss/)

Or:

1. Open `index.html` in a browser (no build step or server required; requires internet access to reach AniList).
2. Type an anime title into the search box (the map zooms in tight on the surface while you type).
3. Press **Descend** (or hit Enter) — the search box and header hide, the map zooms out, and once that settles the page auto-scrolls to your anime's spot on the Abyss map, marked with a cover-art dot.
4. Click **Details** (top-right) or the marker itself to reveal the niche score, cover art, and tag breakdown/judgement buttons.
5. Click **Show tag breakdown** or **Judgement Details** to see the data behind the score (only one panel shows at a time).
6. Click **Search** (top-left) to return to the surface and search again.

## Technologies

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details on the project structure.
