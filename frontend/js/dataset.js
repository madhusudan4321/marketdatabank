import { apiFetch, authFetch, isLoggedIn, getUser, renderNav, showToast, formatDate, formatSize, getQueryParam } from './api.js';

renderNav();

const datasetId = getQueryParam('id');
if (!datasetId) { window.location.href = '/'; }

let previewData = null;
let chartInstance = null;
let currentChartType = 'bar';

async function init() {
  try {
    const [dataset, preview] = await Promise.all([
      apiFetch(`/datasets/${datasetId}`),
      apiFetch(`/datasets/${datasetId}/preview`).catch(() => null),
    ]);

    renderDetail(dataset);
    if (preview) {
      previewData = preview;
      renderPreview(preview);
      setupViz(preview);
    } else {
      document.getElementById('preview-container').innerHTML = '<p style="color:var(--text-muted);padding:12px 0;">Preview unavailable.</p>';
      document.getElementById('viz-setup').style.display = 'none';
    }
    loadComments();
    setupCommentForm(dataset._id);
    setupLike(dataset);
    setupDeleteBtn(dataset);
  } catch (err) {
    document.getElementById('dataset-root').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Failed to load dataset</h3>
        <p>${err.message}</p>
        <a href="/" class="btn btn-secondary" style="margin-top:16px;">← Go Home</a>
      </div>`;
  }
}

function renderDetail(d) {
  const template = document.getElementById('detail-template');
  const clone = template.content.cloneNode(true);
  document.getElementById('dataset-root').innerHTML = '';
  document.getElementById('dataset-root').appendChild(clone);

  const ext = (d.fileType || 'csv').toLowerCase();
  document.title = `${d.title} — Market Databank`;
  document.getElementById('dt-title').textContent = d.title;
  document.getElementById('dt-desc').textContent = d.description;
  document.getElementById('dt-uploader').textContent = d.uploadedBy?.name || 'Unknown';
  document.getElementById('dt-date').textContent = formatDate(d.createdAt);
  document.getElementById('dt-downloads').textContent = d.downloadCount;
  document.getElementById('dt-file-size').textContent = formatSize(d.fileSize || 0);

  const badge = document.getElementById('dt-file-badge');
  badge.className = `file-badge ${ext}`;
  badge.textContent = ext.toUpperCase();

  const tagsEl = document.getElementById('dt-tags');
  d.tags.forEach((t) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `# ${t}`;
    tagsEl.appendChild(span);
  });

  // Like
  document.getElementById('like-count').textContent = d.likes.length;
  const user = getUser();
  if (user && d.likes.map(String).includes(String(user.id))) {
    document.getElementById('like-btn').classList.add('liked');
  }

  // Download — must be done via JS fetch + Blob because:
  // 1. The frontend & backend are on different subdomains (cross-origin).
  // 2. Browsers silently ignore the `download` attribute on cross-origin <a> tags.
  const dlBtn = document.getElementById('download-btn');
  dlBtn.removeAttribute('href');
  dlBtn.style.cursor = 'pointer';
  dlBtn.addEventListener('click', () => downloadFile(d));
}

function renderPreview(preview) {
  const container = document.getElementById('preview-container');
  document.getElementById('preview-total').textContent = `Showing 10 of ${preview.total} rows`;

  if (!preview.rows.length) {
    container.innerHTML = '<p style="color:var(--text-muted);">No data to preview.</p>';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'table-wrapper';
  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${preview.columns.map((c) => `<th>${escHtml(c)}</th>`).join('')}</tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  preview.rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = preview.columns.map((c) => `<td title="${escHtml(String(row[c] ?? ''))}">${escHtml(String(row[c] ?? ''))}</td>`).join('');
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  container.innerHTML = '';
  container.appendChild(wrap);
}

function setupViz(preview) {
  if (!preview.columns.length) return;

  const xSel = document.getElementById('x-col');
  preview.columns.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    xSel.appendChild(opt);
  });

  const yContainer = document.getElementById('y-cols');
  preview.columns.forEach((c, i) => {
    const label = document.createElement('label');
    label.className = 'col-checkbox-label';
    label.innerHTML = `<input type="checkbox" value="${c}" ${i === 1 ? 'checked' : ''} /> ${escHtml(c)}`;
    yContainer.appendChild(label);
  });

  // Chart type toggle
  document.querySelectorAll('.chart-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentChartType = btn.dataset.type;
    });
  });

  document.getElementById('render-chart-btn').addEventListener('click', renderChart);
}

function renderChart() {
  if (!previewData) return;
  const errEl = document.getElementById('chart-error');
  errEl.textContent = '';

  const xCol = document.getElementById('x-col').value;
  const yCols = [...document.querySelectorAll('#y-cols input:checked')].map((el) => el.value);

  if (!yCols.length) {
    errEl.textContent = 'Please select at least one Y-axis column.';
    return;
  }

  const labels = previewData.rows.map((r) => String(r[xCol] ?? ''));
  const colors = ['#6366f1','#8b5cf6','#ec4899','#10b981','#f59e0b','#3b82f6'];

  const datasets = yCols.map((col, i) => ({
    label: col,
    data: previewData.rows.map((r) => parseFloat(r[col]) || 0),
    backgroundColor: colors[i % colors.length] + '88',
    borderColor: colors[i % colors.length],
    borderWidth: 2,
    borderRadius: currentChartType === 'bar' ? 6 : 0,
    tension: 0.4,
    fill: currentChartType === 'line',
  }));

  const canvas = document.getElementById('viz-chart');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvas, {
    type: currentChartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
        tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8' },
      },
      scales: {
        x: { ticks: { color: '#475569', font: { family: 'Inter' } }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#475569', font: { family: 'Inter' } }, grid: { color: '#1e293b' } },
      },
    },
  });
}

// ── Likes ──
function setupLike(dataset) {
  const btn = document.getElementById('like-btn');
  btn.addEventListener('click', async () => {
    if (!isLoggedIn()) { window.location.href = '/login.html'; return; }
    try {
      const res = await authFetch(`/datasets/${dataset._id}/like`, { method: 'POST' });
      document.getElementById('like-count').textContent = res.likesCount;
      btn.classList.toggle('liked', res.liked);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ── Delete ──
function setupDeleteBtn(dataset) {
  const user = getUser();
  if (!user) return;
  const isOwner = String(dataset.uploadedBy?._id || dataset.uploadedBy) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) return;

  const btn = document.getElementById('delete-btn');
  btn.style.display = 'inline-flex';
  btn.addEventListener('click', async () => {
    if (!confirm('Delete this dataset? This action cannot be undone.')) return;
    try {
      await authFetch(`/datasets/${dataset._id}`, { method: 'DELETE' });
      showToast('Dataset deleted.', 'success');
      setTimeout(() => { window.location.href = '/'; }, 900);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ── Comments ──
async function loadComments() {
  const list = document.getElementById('comments-list');
  try {
    const comments = await apiFetch(`/comments/${datasetId}`);
    renderComments(comments);
  } catch {
    list.innerHTML = '<p style="color:var(--text-muted);">Failed to load comments.</p>';
  }
}

function renderComments(comments) {
  const list = document.getElementById('comments-list');
  const user = getUser();
  if (!comments.length) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.875rem;">No comments yet. Be the first!</p>';
    return;
  }
  list.innerHTML = comments.map((c) => {
    const canDel = user && (String(c.userId?._id || c.userId) === String(user.id) || user.role === 'admin');
    return `
      <div class="comment-item" id="comment-${c._id}">
        <div class="comment-header">
          <div>
            <span class="comment-author">👤 ${escHtml(c.userId?.name || 'User')}</span>
            <span class="comment-date" style="margin-left:10px;">${formatDate(c.createdAt)}</span>
          </div>
          ${canDel ? `<button class="btn btn-danger btn-sm" onclick="deleteComment('${c._id}')">Delete</button>` : ''}
        </div>
        <p class="comment-text">${escHtml(c.comment)}</p>
      </div>`;
  }).join('');
}

window.deleteComment = async (id) => {
  try {
    await authFetch(`/comments/${id}`, { method: 'DELETE' });
    document.getElementById(`comment-${id}`)?.remove();
    showToast('Comment deleted.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function setupCommentForm(dsId) {
  const user = getUser();
  const formWrap = document.getElementById('comment-form-wrap');
  const loginMsg = document.getElementById('comment-login-msg');

  if (user) {
    formWrap.style.display = 'block';
    document.getElementById('comment-submit').addEventListener('click', async () => {
      const text = document.getElementById('comment-input').value.trim();
      if (!text) return;
      try {
        await authFetch('/comments', {
          method: 'POST',
          body: JSON.stringify({ datasetId: dsId, comment: text }),
        });
        document.getElementById('comment-input').value = '';
        showToast('Comment posted!', 'success');
        loadComments();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } else {
    loginMsg.style.display = 'block';
  }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── Download via Blob (works cross-origin) ──
async function downloadFile(dataset) {
  const dlBtn = document.getElementById('download-btn');
  dlBtn.textContent = '⏳ Downloading…';
  dlBtn.style.pointerEvents = 'none';

  try {
    const BACKEND = 'https://marketdatabank-backend.onrender.com/api';
    const response = await fetch(`${BACKEND}/datasets/${dataset._id}/download`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = (dataset.fileType || 'csv').toLowerCase();
    a.download = `${dataset.title}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update download count in UI
    const el = document.getElementById('dt-downloads');
    if (el) el.textContent = parseInt(el.textContent || '0') + 1;

    showToast('Download started! ✅', 'success');
  } catch (err) {
    showToast(`Download failed: ${err.message}`, 'error');
  } finally {
    dlBtn.innerHTML = '⬇️ Download';
    dlBtn.style.pointerEvents = '';
  }
}

init();
