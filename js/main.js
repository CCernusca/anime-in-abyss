const input = document.getElementById('anime-input');
const btn = document.getElementById('search-btn');
const resultSection = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultScore = document.getElementById('result-score');
const resultLayer = document.getElementById('result-layer');

btn.addEventListener('click', handleSearch);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

function handleSearch() {
  const title = input.value.trim();
  if (!title) return;

  resultTitle.textContent = title;
  resultScore.textContent = 'Niche score: TBD';
  resultLayer.textContent = 'Abyss layer: TBD';
  resultSection.hidden = false;
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
      <td>${tag.fraction.toFixed(2)}</td>
      <td>${tag.avgAcceptance.toFixed(2)}</td>
      <td>${tag.score.toFixed(2)}</td>
    `;
    tagTableBody.appendChild(row);
  }
  judgementStatus.hidden = true;
  tagTable.hidden = false;
}

AniList.getJudgementData()
  .then(renderJudgementDetails)
  .catch((err) => {
    judgementStatus.textContent = 'Could not load tag data from AniList.';
    console.error(err);
  });
