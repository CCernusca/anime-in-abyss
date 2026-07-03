# Anime in Abyss

A little webapp that computes a measure of how niche an anime is and visualizes the result using Made in Abyss references (layers of the Abyss).

## Features

- Search for any anime by title (fetched live from AniList) and get a **niche score** for it — the more its tags are common/mainstream among the top 100 most popular anime, the higher the score.
- If no matching anime is found on AniList, you'll get a clear error instead of a broken result.
- Expand **Show tag breakdown** below the score to see exactly which of the anime's tags contributed, and how much each one added.
- The page background is the Made in Abyss map — a higher score drops your marker near the surface, a lower (nichier) score sends it deep into the Abyss, and the page auto-scrolls to show you where you landed.
- **Judgement Details** — click the **Details** button (top-right) to see how the judging works generally: the app pulls the top 100 most popular anime from AniList and breaks down every tag they carry into a "mainstream score" (how common the tag is, weighted by how strongly the community says it applies), shown in a table with an explanation of what each column means.

## Usage

1. Open `index.html` in a browser (no build step or server required; requires internet access to reach AniList).
2. Type an anime title into the search box.
3. Press **Descend** (or hit Enter) to see its niche score — the page will auto-scroll to your anime's spot on the Abyss map, marked with a dot.
4. Click **Show tag breakdown** to see which tags drove that score.
5. Click **Details** (top-right) to see the general tag-weighting explanation and data behind the judging.

## Contributing

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details on the project structure.

**When adding a feature, update this README and ARCHITECTURE.md accordingly.**
