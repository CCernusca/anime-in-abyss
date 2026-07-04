const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const TOP_N = 100;
const PER_PAGE = 50;
const CACHE_KEY = 'aia_tag_judgement_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const TOP_ANIME_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: POPULARITY_DESC, type: ANIME) {
        id
        title { romaji }
        tags { name rank }
      }
    }
  }
`;

const ANIME_BY_TITLE_QUERY = `
  query ($search: String) {
    Media(search: $search, type: ANIME) {
      id
      title { romaji }
      tags { name rank }
      coverImage { large }
    }
  }
`;

async function fetchAnimeByTitle(title) {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ANIME_BY_TITLE_QUERY, variables: { search: title } }),
  });
  // AniList responds 404 (rather than 200 + null) when the Media query finds no match
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
  const { data } = await res.json();
  return data.Media;
}

async function fetchTopAnime() {
  const pageCount = Math.ceil(TOP_N / PER_PAGE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      fetch(ANILIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: TOP_ANIME_QUERY,
          variables: { page: i + 1, perPage: PER_PAGE },
        }),
      }).then((res) => {
        if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
        return res.json();
      })
    )
  );
  return pages.flatMap((p) => p.data.Page.media).slice(0, TOP_N);
}

// score = (fraction of anime carrying the tag) * (avg community rank of the tag)
// high score = tag is both common AND highly relevant among popular anime (mainstream signal)
function computeTagStats(mediaList) {
  const totals = new Map();

  for (const media of mediaList) {
    for (const tag of media.tags || []) {
      const entry = totals.get(tag.name) || { count: 0, rankSum: 0 };
      entry.count += 1;
      entry.rankSum += tag.rank;
      totals.set(tag.name, entry);
    }
  }

  const sampleSize = mediaList.length;
  const stats = Array.from(totals.entries()).map(([name, { count, rankSum }]) => {
    const fraction = count / sampleSize;
    const avgAcceptance = rankSum / count / 100;
    return {
      name,
      count,
      fraction,
      avgAcceptance,
      score: fraction * avgAcceptance,
    };
  });

  stats.sort((a, b) => b.score - a.score);
  return stats;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.tags;
  } catch {
    return null;
  }
}

function writeCache(tags) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), tags }));
  } catch {
    // storage unavailable/full — non-fatal, just skip caching
  }
}

async function getJudgementData() {
  const cached = readCache();
  if (cached) return cached;

  const mediaList = await fetchTopAnime();
  const tags = computeTagStats(mediaList);
  writeCache(tags);
  return tags;
}

window.AniList = { getJudgementData, fetchAnimeByTitle };
