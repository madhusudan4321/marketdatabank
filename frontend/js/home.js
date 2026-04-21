import { apiFetch, isLoggedIn, getUser, renderNav, formatDate, formatSize } from './api.js';

renderNav();

// Hero buttons + hide admin nav button when logged in
const user = getUser();
if (user) {
  document.getElementById('hero-upload-btn').style.display = 'inline-flex';
  document.getElementById('hero-login-btn').style.display = 'none';
  const adminNavBtn = document.getElementById('nav-admin-login');
  if (adminNavBtn) adminNavBtn.style.display = 'none';
}

let allDatasets = [];
let activeTag = null;

// ── Load datasets ──
async function loadDatasets(search = '') {
  const container = document.getElementById('datasets-container');
  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const data = await apiFetch(`/datasets?${params}`);
    allDatasets = data;
    renderTagFilters(data);
    renderDatasets(data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Failed to load datasets</h3><p>${err.message}</p></div>`;
  }
}

function renderTagFilters(datasets) {
  const tagSet = new Set();
  datasets.forEach((d) => d.tags.forEach((t) => tagSet.add(t)));
  const container = document.getElementById('tag-filters');
  if (tagSet.size === 0) { container.innerHTML = ''; return; }

  const allBtn = document.createElement('button');
  allBtn.className = 'tag';
  allBtn.style.cssText = !activeTag ? 'background:rgba(99,102,241,0.3);' : '';
  allBtn.textContent = '# All';
  allBtn.addEventListener('click', () => { activeTag = null; renderTagFilters(allDatasets); renderDatasets(allDatasets); });
  container.innerHTML = '';
  container.appendChild(allBtn);

  tagSet.forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = 'tag';
    if (activeTag === tag) btn.style.background = 'rgba(99,102,241,0.3)';
    btn.textContent = `# ${tag}`;
    btn.addEventListener('click', () => {
      activeTag = tag;
      const filtered = allDatasets.filter((d) => d.tags.includes(tag));
      renderTagFilters(allDatasets);
      renderDatasets(filtered);
    });
    container.appendChild(btn);
  });
}

// ── Avatar circle helper ──
function avatarCircle(name) {
  const initial = (name || '?').charAt(0).toUpperCase();
  // Generate a stable hue from the name string
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `<div style="
    width:28px; height:28px; border-radius:50%; flex-shrink:0;
    background:linear-gradient(135deg, hsl(${hue},65%,55%), hsl(${(hue+40)%360},65%,45%));
    display:inline-flex; align-items:center; justify-content:center;
    font-size:0.72rem; font-weight:800; color:#fff;
    border: 2px solid rgba(255,255,255,0.08);
  ">${initial}</div>`;
}

function renderDatasets(datasets) {
  const container = document.getElementById('datasets-container');
  if (!datasets.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>No datasets found</h3><p>Try a different search or upload the first one!</p></div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'datasets-grid';

  datasets.forEach((d) => {
    const card = document.createElement('div');
    card.className = 'dataset-card';
    card.addEventListener('click', () => { window.location.href = `/dataset.html?id=${d._id}`; });

    const tagsHtml = d.tags.slice(0, 4).map((t) => `<span class="tag"># ${t}</span>`).join('');
    const uploader = d.uploadedBy?.name || 'Unknown';
    const ext = (d.fileType || 'csv').toLowerCase();

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span class="file-badge ${ext}">${ext.toUpperCase()}</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">${formatSize(d.fileSize || 0)}</span>
      </div>
      <div class="dataset-card-title">${escHtml(d.title)}</div>
      <div class="dataset-card-desc">${escHtml(d.description)}</div>
      ${tagsHtml ? `<div class="tags-row">${tagsHtml}</div>` : ''}
      <div style="display:flex; align-items:center; gap:8px; margin-top:auto; padding-top:8px;">
        ${avatarCircle(uploader)}
        <span style="font-size:0.8rem; color:var(--text-secondary); font-weight:500;">${escHtml(uploader)}</span>
        <span style="margin-left:auto; font-size:0.75rem; color:var(--text-muted);">📅 ${formatDate(d.createdAt)}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── Search ──
let searchTimer;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  activeTag = null;
  searchTimer = setTimeout(() => loadDatasets(e.target.value.trim()), 350);
});

// Initial load
loadDatasets();
