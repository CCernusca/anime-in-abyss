if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

const input = document.getElementById('anime-input');
const btn = document.getElementById('search-btn');
const searchSection = document.getElementById('search');
const backBtn = document.getElementById('back-btn');
const headerTitle = document.querySelector('header h1');
const headerSubtitle = document.getElementById('header-subtitle');
const resultSection = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultCover = document.getElementById('result-cover');
const resultScore = document.getElementById('result-score');
const resultLayer = document.getElementById('result-layer');
const resultError = document.getElementById('result-error');
const contributionsBtn = document.getElementById('contributions-btn');
const contributionsTable = document.getElementById('contributions-table');
const contributionsTableBody = document.getElementById('contributions-table-body');

const judgementDataPromise = AniList.getJudgementData();

const errorPopup = document.getElementById('error-popup');
const errorPopupMessage = document.getElementById('error-popup-message');
const errorPopupClose = document.getElementById('error-popup-close');

function showErrorPopup(message) {
  errorPopupMessage.textContent = message;
  errorPopup.hidden = false;
}

errorPopupClose.addEventListener('click', () => {
  errorPopup.hidden = true;
});

document.body.style.backgroundPositionX = '51.5%';

btn.addEventListener('click', handleSearch);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});
input.addEventListener('focus', () => {
  document.body.classList.remove('descending');
  document.body.classList.add('zoomed-in');
});

backBtn.addEventListener('click', () => {
  cancelPendingMarkerReveal();
  searchSection.hidden = false;
  headerTitle.hidden = false;
  headerSubtitle.hidden = false;
  backBtn.hidden = true;
  detailsBtn.hidden = true;
  resultSection.hidden = true;
  document.body.classList.remove('descending');
  document.body.classList.add('zoomed-in');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  waitForScrollEnd(0, () => {
    input.focus();
  });
});

contributionsBtn.addEventListener('click', () => {
  const opening = contributionsTable.hidden;
  contributionsTable.hidden = !opening;
  if (opening) judgementDetails.hidden = true;
});

const MARKER_TOP_AT_SCORE_1 = 150;
const MARKER_TOP_AT_SCORE_0 = 2200;

const ZOOM_TRANSITION_MS = 1400;
const MARKER_REVEAL_DELAY_MS = ZOOM_TRANSITION_MS;
let markerRevealTimeoutId = null;
let scrollWatchRafId = null;
let pendingMarkerEl = null;
let panningTimeoutId = null;

// entry currently shown in #result (may be an older marker the user clicked)
let currentEntry = null;
// most recently searched anime — what #details-btn (top-right) always opens
let latestSearchEntry = null;

function cancelPendingMarkerReveal() {
  clearTimeout(markerRevealTimeoutId);
  markerRevealTimeoutId = null;
  cancelAnimationFrame(scrollWatchRafId);
  scrollWatchRafId = null;
  clearTimeout(panningTimeoutId);
  panningTimeoutId = null;
  document.body.classList.remove('panning');
  // don't leave a completed search without a marker just because the user bailed early
  if (pendingMarkerEl) {
    pendingMarkerEl.hidden = false;
    pendingMarkerEl = null;
  }
}

function waitForScrollEnd(target, callback) {
  let stableFrames = 0;
  function check() {
    const y = window.scrollY;
    if (Math.abs(y - target) < 1) {
      stableFrames++;
    } else {
      stableFrames = 0;
    }
    if (stableFrames >= 3) {
      scrollWatchRafId = null;
      callback();
    } else {
      scrollWatchRafId = requestAnimationFrame(check);
    }
  }
  scrollWatchRafId = requestAnimationFrame(check);
}

// populates the shared #result panel with one anime's data; `reveal` controls
// whether the (possibly hidden) panel is forced open or just kept in sync
function showResultFor(entry, reveal) {
  currentEntry = entry;
  resultTitle.textContent = entry.title;
  if (entry.coverUrl) {
    resultCover.src = entry.coverUrl;
    resultCover.alt = `${entry.title} cover`;
    resultCover.hidden = false;
  } else {
    resultCover.hidden = true;
    resultCover.src = '';
  }
  resultScore.textContent = `Niche score: ${entry.score.toFixed(4)}`;
  resultLayer.textContent = 'Abyss layer: TBD';
  resultError.hidden = true;
  renderContributions(entry.contributions);
  contributionsBtn.hidden = false;
  contributionsTable.hidden = true;
  judgementDetails.hidden = true;
  if (reveal) {
    resultSection.hidden = false;
    if (entry.markerTop !== undefined) {
      const target = Math.max(0, entry.markerTop - window.innerHeight / 2);
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  }
}

// each search adds a new marker to the map; none of them are ever removed —
// they persist for the rest of the session (until reload/exit)
function placeMarker(entry) {
  const clamped = Math.max(0, Math.min(1, entry.score));
  const top = MARKER_TOP_AT_SCORE_0 - clamped * (MARKER_TOP_AT_SCORE_0 - MARKER_TOP_AT_SCORE_1);
  entry.markerTop = top;

  const el = document.createElement('div');
  el.className = 'abyss-marker';
  el.style.top = `${top}px`;
  el.hidden = true;
  if (entry.coverUrl) {
    el.style.backgroundImage = `url('${entry.coverUrl}')`;
  }
  el.addEventListener('click', () => {
    showResultFor(entry, true);
  });
  document.body.appendChild(el);

  pendingMarkerEl = el;
  markerRevealTimeoutId = setTimeout(() => {
    markerRevealTimeoutId = null;
    const target = Math.max(0, top - window.innerHeight / 2);
    window.scrollTo({ top: target, behavior: 'smooth' });
    waitForScrollEnd(target, () => {
      pendingMarkerEl = null;
      el.hidden = false;
    });
  }, MARKER_REVEAL_DELAY_MS);
}

const MAX_TAGS = 10;

// score = sum over the anime's 10 most-accepted tags that also appear in the
// weights table, of (tag weight)^2 * (this anime's community acceptance of the tag, 0-1)
function computeNicheScore(animeTags, weightTags) {
  const weightByName = new Map(weightTags.map((t) => [t.name, t.score]));
  const topTags = [...animeTags].sort((a, b) => b.rank - a.rank).slice(0, MAX_TAGS);
  const contributions = [];
  let score = 0;

  for (const tag of topTags) {
    const weight = weightByName.get(tag.name);
    if (weight === undefined) continue;
    const acceptance = tag.rank / 100;
    const contribution = weight * weight * acceptance;
    score += contribution;
    contributions.push({ name: tag.name, weight, acceptance, contribution });
  }

  contributions.sort((a, b) => b.contribution - a.contribution);
  return { score, contributions };
}

function renderContributions(contributions) {
  contributionsTableBody.innerHTML = '';
  for (const c of contributions) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${c.name}</td>
      <td>${c.weight.toFixed(4)}</td>
      <td>${c.acceptance.toFixed(4)}</td>
      <td>${c.contribution.toFixed(4)}</td>
    `;
    contributionsTableBody.appendChild(row);
  }
}

function resetResult() {
  resultSection.hidden = true;
  resultError.hidden = true;
  contributionsBtn.hidden = true;
  contributionsTable.hidden = true;
  judgementDetails.hidden = true;
  resultTitle.textContent = '';
  resultCover.hidden = true;
  resultCover.src = '';
  resultScore.textContent = '';
  resultLayer.textContent = '';
}

async function handleSearch() {
  const title = input.value.trim();
  if (!title) return;

  searchSection.hidden = true;
  headerTitle.hidden = true;
  headerSubtitle.hidden = true;
  backBtn.hidden = false;
  detailsBtn.hidden = false;
  document.body.classList.remove('zoomed-in');
  document.body.classList.add('descending');
  document.body.classList.add('panning');
  clearTimeout(panningTimeoutId);
  panningTimeoutId = setTimeout(() => {
    panningTimeoutId = null;
    document.body.classList.remove('panning');
  }, ZOOM_TRANSITION_MS);

  resetResult();
  resultTitle.textContent = title;
  resultScore.textContent = 'Searching...';

  try {
    const [anime, weightTags] = await Promise.all([
      AniList.fetchAnimeByTitle(title),
      judgementDataPromise,
    ]);

    if (!anime) {
      resultTitle.textContent = title;
      resultScore.textContent = '';
      resultError.textContent = `No anime found on AniList matching "${title}".`;
      resultError.hidden = false;
      return;
    }

    const { score, contributions } = computeNicheScore(anime.tags || [], weightTags);
    const entry = {
      title: anime.title.romaji,
      score,
      contributions,
      coverUrl: (anime.coverImage && anime.coverImage.large) || null,
    };

    latestSearchEntry = entry;
    showResultFor(entry, false);
    placeMarker(entry);
  } catch (err) {
    resultScore.textContent = '';
    resultError.textContent = 'Something went wrong fetching data from AniList.';
    resultError.hidden = false;
    showErrorPopup('Something went wrong fetching data from AniList.');
    console.error(err);
  }
}

const detailsBtn = document.getElementById('details-btn');
const judgementDetailsBtn = document.getElementById('judgement-details-btn');
const judgementDetails = document.getElementById('judgement-details');
const judgementStatus = document.getElementById('judgement-status');
const tagTable = document.getElementById('tag-table');
const tagTableBody = document.getElementById('tag-table-body');

detailsBtn.addEventListener('click', () => {
  if (!latestSearchEntry) return;
  if (resultSection.hidden) {
    showResultFor(latestSearchEntry, true);
  } else {
    resultSection.hidden = true;
  }
});

document.addEventListener('click', (e) => {
  if (resultSection.hidden) return;
  if (resultSection.contains(e.target)) return;
  if (e.target.closest && e.target.closest('.abyss-marker')) return;
  if (e.target === detailsBtn) return;
  resultSection.hidden = true;
});

judgementDetailsBtn.addEventListener('click', () => {
  const opening = judgementDetails.hidden;
  judgementDetails.hidden = !opening;
  if (opening) contributionsTable.hidden = true;
});

function renderJudgementDetails(tags) {
  tagTableBody.innerHTML = '';
  for (const tag of tags) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tag.name}</td>
      <td>${tag.fraction.toFixed(4)}</td>
      <td>${tag.avgAcceptance.toFixed(4)}</td>
      <td>${tag.score.toFixed(4)}</td>
    `;
    tagTableBody.appendChild(row);
  }
  judgementStatus.hidden = true;
  tagTable.hidden = false;
}

judgementDataPromise
  .then(renderJudgementDetails)
  .catch((err) => {
    judgementStatus.textContent = 'Could not load tag data from AniList.';
    showErrorPopup('Could not load tag data from AniList. Some features may not work.');
    console.error(err);
  });
