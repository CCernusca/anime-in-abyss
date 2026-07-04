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
const resultScore = document.getElementById('result-score');
const resultLayer = document.getElementById('result-layer');
const resultError = document.getElementById('result-error');
const contributionsBtn = document.getElementById('contributions-btn');
const contributionsTable = document.getElementById('contributions-table');
const contributionsTableBody = document.getElementById('contributions-table-body');

const judgementDataPromise = AniList.getJudgementData();

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
  abyssMarker.hidden = true;
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

const abyssMarker = document.getElementById('abyss-marker');
const MARKER_TOP_AT_SCORE_1 = 150;
const MARKER_TOP_AT_SCORE_0 = 2200;

const ZOOM_TRANSITION_MS = 1400;
const MARKER_REVEAL_DELAY_MS = ZOOM_TRANSITION_MS;
let markerRevealTimeoutId = null;
let scrollWatchRafId = null;

function cancelPendingMarkerReveal() {
  clearTimeout(markerRevealTimeoutId);
  markerRevealTimeoutId = null;
  cancelAnimationFrame(scrollWatchRafId);
  scrollWatchRafId = null;
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

function placeMarker(score) {
  const clamped = Math.max(0, Math.min(1, score));
  const top = MARKER_TOP_AT_SCORE_0 - clamped * (MARKER_TOP_AT_SCORE_0 - MARKER_TOP_AT_SCORE_1);
  abyssMarker.style.top = `${top}px`;
  markerRevealTimeoutId = setTimeout(() => {
    markerRevealTimeoutId = null;
    const target = Math.max(0, top - window.innerHeight / 2);
    window.scrollTo({ top: target, behavior: 'smooth' });
    waitForScrollEnd(target, () => {
      abyssMarker.hidden = false;
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
  resultScore.textContent = '';
  resultLayer.textContent = '';
  abyssMarker.hidden = true;
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

    resultTitle.textContent = anime.title.romaji;
    resultScore.textContent = `Niche score: ${score.toFixed(4)}`;
    resultLayer.textContent = 'Abyss layer: TBD';

    renderContributions(contributions);
    contributionsBtn.hidden = false;
    placeMarker(score);
  } catch (err) {
    resultScore.textContent = '';
    resultError.textContent = 'Something went wrong fetching data from AniList.';
    resultError.hidden = false;
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
  if (resultTitle.textContent) {
    resultSection.hidden = !resultSection.hidden;
  }
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
    console.error(err);
  });
