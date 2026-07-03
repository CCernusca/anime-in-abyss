const input = document.getElementById('anime-input');
const btn = document.getElementById('search-btn');
const resultSection = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultScore = document.getElementById('result-score');
const resultLayer = document.getElementById('result-layer');
const resultError = document.getElementById('result-error');
const contributionsBtn = document.getElementById('contributions-btn');
const contributionsTable = document.getElementById('contributions-table');
const contributionsTableBody = document.getElementById('contributions-table-body');

const judgementDataPromise = AniList.getJudgementData();

btn.addEventListener('click', handleSearch);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

contributionsBtn.addEventListener('click', () => {
  contributionsTable.hidden = !contributionsTable.hidden;
});

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
  resultSection.hidden = false;
  resultError.hidden = true;
  contributionsBtn.hidden = true;
  contributionsTable.hidden = true;
  resultTitle.textContent = '';
  resultScore.textContent = '';
  resultLayer.textContent = '';
}

async function handleSearch() {
  const title = input.value.trim();
  if (!title) return;

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
  } catch (err) {
    resultScore.textContent = '';
    resultError.textContent = 'Something went wrong fetching data from AniList.';
    resultError.hidden = false;
    console.error(err);
  }
}

const detailsBtn = document.getElementById('details-btn');
const judgementDetails = document.getElementById('judgement-details');
const judgementStatus = document.getElementById('judgement-status');
const tagTable = document.getElementById('tag-table');
const tagTableBody = document.getElementById('tag-table-body');

detailsBtn.addEventListener('click', () => {
  judgementDetails.hidden = !judgementDetails.hidden;
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
