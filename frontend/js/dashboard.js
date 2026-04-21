import { authFetch, isLoggedIn, getUser, renderNav, showToast, formatDate, formatSize } from './api.js';

if (!isLoggedIn()) {
  showToast('Please login to view your dashboard.', 'error');
  setTimeout(() => { window.location.href = '/login.html'; }, 800);
}

renderNav();

const user = getUser();
if (user) {
  document.getElementById('dash-name').textContent = user.name;
  document.getElementById('dash-email').textContent = user.email;
  const roleEl = document.getElementById('dash-role');
  roleEl.textContent = user.role === 'admin' ? 'Admin' : 'User';
  roleEl.className = `badge badge-${user.role}`;
  document.getElementById('avatar-circle').textContent = user.name.charAt(0).toUpperCase();
}

// ── Status badge helper ──
function statusBadge(status) {
  const map = {
    pending:  { label: '⏳ Pending',  color: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  text: '#f59e0b' },
    approved: { label: '✅ Approved', color: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  text: '#10b981' },
    rejected: { label: '❌ Rejected', color: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   text: '#ef4444' },
  };
  const s = map[status] || map.pending;
  return `<span style="padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;
    background:${s.color};border:1px solid ${s.border};color:${s.text};">${s.label}</span>`;
}

// ── Load dashboard ──
async function loadDashboard() {
  try {
    const { datasets, stats } = await authFetch('/users/dashboard');
    document.getElementById('dash-total').textContent = stats.totalDatasets;
    document.getElementById('dash-downloads').textContent = stats.totalDownloads;
    document.getElementById('dash-likes').textContent = stats.totalLikes;
    renderTable(datasets);

    // Admin: also load pending requests panel
    if (user?.role === 'admin') {
      const pendingSection = document.getElementById('pending-section');
      if (pendingSection) pendingSection.style.display = 'block';
      loadPendingRequests();
    }
  } catch (err) {
    document.getElementById('dash-table-container').innerHTML =
      `<p style="color:var(--danger);padding:16px;">${err.message}</p>`;
  }
}

// ── User datasets table ──
function renderTable(datasets) {
  const container = document.getElementById('dash-table-container');
  if (!datasets.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 0;">
        <div class="empty-icon">📭</div>
        <h3>No datasets yet</h3>
        <p>Upload your first dataset to get started.</p>
        <a href="/upload.html" class="btn btn-primary" style="margin-top:16px;">📤 Upload Dataset</a>
      </div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.overflowX = 'auto';
  const table = document.createElement('table');
  table.className = 'dash-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Title</th>
        <th>Type</th>
        <th>Size</th>
        <th>Status</th>
        <th>Downloads</th>
        <th>Likes</th>
        <th>Uploaded</th>
        <th>Actions</th>
      </tr>
    </thead>`;

  const tbody = document.createElement('tbody');
  datasets.forEach((d) => {
    const ext = (d.fileType || 'csv').toLowerCase();
    const tr = document.createElement('tr');
    const rejNote = d.status === 'rejected' && d.rejectionReason
      ? `<div style="font-size:0.72rem;color:var(--danger);margin-top:4px;">Reason: ${escHtml(d.rejectionReason)}</div>` : '';
    tr.innerHTML = `
      <td>
        <a href="/dataset.html?id=${d._id}" style="color:var(--accent);font-weight:600;text-decoration:none;">
          ${escHtml(d.title)}
        </a>
        ${rejNote}
      </td>
      <td><span class="file-badge ${ext}">${ext.toUpperCase()}</span></td>
      <td>${formatSize(d.fileSize || 0)}</td>
      <td>${statusBadge(d.status)}</td>
      <td style="text-align:center;">⬇️ ${d.downloadCount}</td>
      <td style="text-align:center;">❤️ ${d.likes.length}</td>
      <td>${formatDate(d.createdAt)}</td>
      <td>
        <button class="btn btn-danger btn-sm" data-id="${d._id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  container.innerHTML = '';
  container.appendChild(wrap);

  table.querySelectorAll('[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => deleteDataset(btn.dataset.id, btn));
  });
}

// ── Admin: Pending requests panel ──
async function loadPendingRequests() {
  const section = document.getElementById('pending-section');
  const container = document.getElementById('pending-container');
  const badge = document.getElementById('pending-badge');
  if (!section) return;

  try {
    const datasets = await authFetch('/datasets/admin/pending');
    badge.textContent = datasets.length;
    badge.style.display = datasets.length ? 'inline-flex' : 'none';

    if (!datasets.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:32px 0;">
          <div class="empty-icon">✅</div>
          <h3>All clear!</h3>
          <p>No pending approval requests right now.</p>
        </div>`;
      return;
    }

    const wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';
    const table = document.createElement('table');
    table.className = 'dash-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Size</th>
          <th>Submitted by</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>`;

    const tbody = document.createElement('tbody');
    datasets.forEach((d) => {
      const ext = (d.fileType || 'csv').toLowerCase();
      const tr = document.createElement('tr');
      tr.id = `pending-row-${d._id}`;
      tr.innerHTML = `
        <td style="font-weight:600;">${escHtml(d.title)}<br>
          <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400;">${escHtml(d.description.slice(0, 80))}…</span>
        </td>
        <td><span class="file-badge ${ext}">${ext.toUpperCase()}</span></td>
        <td>${formatSize(d.fileSize || 0)}</td>
        <td>
          <strong>${escHtml(d.uploadedBy?.name || 'Unknown')}</strong><br>
          <span style="font-size:0.75rem;color:var(--text-muted);">${escHtml(d.uploadedBy?.email || '')}</span>
        </td>
        <td>${formatDate(d.createdAt)}</td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-success btn-sm" data-approve="${d._id}">✅ Approve</button>
            <button class="btn btn-danger btn-sm" data-reject="${d._id}">❌ Reject</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    container.innerHTML = '';
    container.appendChild(wrap);

    // Wire approve buttons
    table.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => approveDataset(btn.dataset.approve, btn));
    });
    // Wire reject buttons
    table.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => rejectDataset(btn.dataset.reject, btn));
    });

  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);padding:16px;">${err.message}</p>`;
  }
}

async function approveDataset(id, btn) {
  btn.disabled = true; btn.textContent = '⏳ Approving…';
  try {
    await authFetch(`/datasets/${id}/approve`, { method: 'PATCH' });
    showToast('Dataset approved and published! ✅', 'success');
    document.getElementById(`pending-row-${id}`)?.remove();
    updatePendingBadge();
    loadDashboard(); // refresh stats
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false; btn.textContent = '✅ Approve';
  }
}

async function rejectDataset(id, btn) {
  const reason = prompt('Reason for rejection (optional):') ?? '';
  if (reason === null) return; // cancelled
  btn.disabled = true; btn.textContent = '⏳ Rejecting…';
  try {
    await authFetch(`/datasets/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    showToast('Dataset rejected.', 'info');
    document.getElementById(`pending-row-${id}`)?.remove();
    updatePendingBadge();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false; btn.textContent = '❌ Reject';
  }
}

function updatePendingBadge() {
  const badge = document.getElementById('pending-badge');
  if (!badge) return;
  const count = parseInt(badge.textContent) - 1;
  badge.textContent = count;
  if (count <= 0) badge.style.display = 'none';
}

// ── Delete dataset ──
async function deleteDataset(id, btn) {
  if (!confirm('Delete this dataset permanently?')) return;
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  try {
    await authFetch(`/datasets/${id}`, { method: 'DELETE' });
    showToast('Dataset deleted.', 'success');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

loadDashboard();
