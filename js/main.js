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
