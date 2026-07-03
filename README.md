# Anime in Abyss

A little webapp that computes a measure of how niche an anime is and visualizes the result using Made in Abyss references (layers of the Abyss).

## Features

- Search for any anime by title
- Get a "niche score" for it
- See the result mapped to an Abyss layer
- **Judgement Details** — click the **Details** button (top-right) to see how the judging works: the app pulls the top 100 most popular anime from AniList and breaks down every tag they carry into a "mainstream score" (how common the tag is, weighted by how strongly the community says it applies), shown in a table with an explanation of what each column means.

*(Niche-score calculation for the searched anime is a work in progress — see [ARCHITECTURE.md](ARCHITECTURE.md) for status.)*

## Usage

1. Open `index.html` in a browser (no build step or server required).
2. Type an anime title into the search box.
3. Press **Descend** (or hit Enter) to see the result.
4. Click **Details** (top-right) to see the tag-weighting explanation and data behind the judging (requires internet access to reach AniList).

## Contributing

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details on the project structure.

**When adding a feature, update this README and ARCHITECTURE.md accordingly.**
