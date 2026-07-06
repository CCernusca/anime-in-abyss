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

// depth-mapping anchors, given as fractions of the map artwork's native height (2642px @
// native width 1708px) rather than fixed page px — body's background-size (and thus the
// map's actual on-screen height) varies by zoom state and viewport (max(<state-px>, 100vw)),
// so a fixed px anchor would only be correct at one particular render scale. Working in
// fractions and multiplying by the CURRENT rendered background height (see
// currentBackgroundHeight()) keeps markers correctly placed regardless of scale.
const MAP_NATIVE_HEIGHT = 2642;
const MAP_NATIVE_WIDTH = 1708;
const MAP_ASPECT = MAP_NATIVE_HEIGHT / MAP_NATIVE_WIDTH;
// mirrors the background-size base widths in css/style.css for each body zoom-state class
const BG_STATE_WIDTH_BASE = 1708;
const BG_STATE_WIDTH_ZOOMED_IN = 6000;
const BG_STATE_WIDTH_DESCENDING = 1300;

function currentBackgroundHeight() {
  let stateWidth = BG_STATE_WIDTH_BASE;
  if (document.body.classList.contains('zoomed-in')) stateWidth = BG_STATE_WIDTH_ZOOMED_IN;
  else if (document.body.classList.contains('descending')) stateWidth = BG_STATE_WIDTH_DESCENDING;
  return Math.max(stateWidth, window.innerWidth) * MAP_ASPECT;
}

// score 0 -> 2328/2642 (deep), 0.25 -> 272/2642, 0.3 -> 125/2642, 1 -> 75/2642 (map ceiling,
// shallowest spot). A single low-degree polynomial through all 4 points overshoots/dips between
// them (secant slopes vary wildly in magnitude between segments). Instead this is a piecewise
// monotone cubic Hermite spline (PCHIP/Fritsch-Carlson), generalized for N anchors: exact
// through every anchor, strictly decreasing (no dip, no clustering), C1-continuous at each join.
const MARKER_ANCHOR_SCORES = [0, 0.25, 0.3, 1];
const MARKER_ANCHOR_FRACTIONS = [2328, 272, 125, 75].map((px) => px / MAP_NATIVE_HEIGHT);

// Fritsch-Carlson monotone tangents: endpoints get the adjacent one-sided secant; interior
// points get the Fritsch-Butland weighted harmonic mean of their two neighboring secants (or
// 0 if those secants disagree in sign/vanish, to preserve a local extremum there).
function monotoneTangents(xs, ys) {
  const n = xs.length;
  const h = [];
  const secants = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    secants.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const d = new Array(n);
  d[0] = secants[0];
  d[n - 1] = secants[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const sL = secants[i - 1];
    const sR = secants[i];
    if (sL === 0 || sR === 0 || sL < 0 !== sR < 0) {
      d[i] = 0;
    } else {
      const hL = h[i - 1];
      const hR = h[i];
      const w1 = 2 * hR + hL;
      const w2 = hR + 2 * hL;
      d[i] = (w1 + w2) / (w1 / sL + w2 / sR);
    }
  }
  return d;
}

const MARKER_TANGENTS = monotoneTangents(MARKER_ANCHOR_SCORES, MARKER_ANCHOR_FRACTIONS);

function hermiteSegment(t, y0, y1, d0, d1, h) {
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
  const h10 = t ** 3 - 2 * t ** 2 + t;
  const h01 = -2 * t ** 3 + 3 * t ** 2;
  const h11 = t ** 3 - t ** 2;
  return h00 * y0 + h10 * h * d0 + h01 * y1 + h11 * h * d1;
}

function markerTopFractionForScore(score) {
  let i = MARKER_ANCHOR_SCORES.length - 2;
  for (let k = 0; k < MARKER_ANCHOR_SCORES.length - 1; k++) {
    if (score <= MARKER_ANCHOR_SCORES[k + 1]) {
      i = k;
      break;
    }
  }
  const segH = MARKER_ANCHOR_SCORES[i + 1] - MARKER_ANCHOR_SCORES[i];
  const t = (score - MARKER_ANCHOR_SCORES[i]) / segH;
  return hermiteSegment(t, MARKER_ANCHOR_FRACTIONS[i], MARKER_ANCHOR_FRACTIONS[i + 1], MARKER_TANGENTS[i], MARKER_TANGENTS[i + 1], segH);
}

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
    pendingMarkerEl.classList.remove('pending');
    pendingMarkerEl = null;
  }
}

// the page's scrollable range can be shorter than a raw marker-derived target (e.g. depending
// on current zoom/panning min-height), and scrollTo silently clamps to it — so any target we
// compute must be clamped the same way, or waitForScrollEnd's y===target check never converges
function maxScrollTop() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
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
      const target = Math.min(Math.max(0, entry.markerTop - window.innerHeight / 2), maxScrollTop());
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  }
}

// each search adds a new marker to the map; none of them are ever removed —
// they persist for the rest of the session (until reload/exit)
function placeMarker(entry) {
  const clamped = Math.max(0, Math.min(1, entry.score));
  const top = markerTopFractionForScore(clamped) * currentBackgroundHeight();
  entry.markerTop = top;

  const el = document.createElement('div');
  el.className = 'abyss-marker pending';
  el.style.top = `${top}px`;
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
    const target = Math.min(Math.max(0, top - window.innerHeight / 2), maxScrollTop());
    window.scrollTo({ top: target, behavior: 'smooth' });
    waitForScrollEnd(target, () => {
      pendingMarkerEl = null;
      el.classList.remove('pending');
    });
  }, MARKER_REVEAL_DELAY_MS);
}

const MAX_TAGS = 10;

// score = avg over the anime's 10 most-accepted tags, of (tag weight) * (this anime's
// community acceptance of the tag, 0-1); tags absent from the weights table use weight 0
function computeNicheScore(animeTags, weightTags) {
  const weightByName = new Map(weightTags.map((t) => [t.name, t.score]));
  const topTags = [...animeTags].sort((a, b) => b.rank - a.rank).slice(0, MAX_TAGS);
  const contributions = [];
  let sum = 0;

  for (const tag of topTags) {
    const weight = weightByName.get(tag.name) || 0;
    const acceptance = tag.rank / 100;
    const contribution = weight * acceptance;
    sum += contribution;
    contributions.push({ name: tag.name, weight, acceptance, contribution });
  }

  contributions.sort((a, b) => b.contribution - a.contribution);
  const score = topTags.length ? sum / topTags.length : 0;
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
