import { isLoggedIn, renderNav, showToast, uploadFetch, formatSize, getUser } from './api.js';

// Auth guard
if (!isLoggedIn()) {
  showToast('Please login to upload datasets.', 'error');
  setTimeout(() => { window.location.href = '/login.html'; }, 1000);
}

renderNav();

// Show approval notice to regular users
const user = getUser();
if (user && user.role !== 'admin') {
  const notice = document.getElementById('approval-notice');
  if (notice) notice.style.display = 'flex';
}

// ── File drop zone ──
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('ds-file');
const filePreview = document.getElementById('file-preview');
const fileNameEl = document.getElementById('file-name');
const fileSizeEl = document.getElementById('file-size');
let selectedFile = null;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

document.getElementById('remove-file').addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  filePreview.style.display = 'none';
  dropZone.style.display = '';
});

function setFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'json'].includes(ext)) {
    showToast('Only .csv and .json files are allowed.', 'error');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('File too large. Maximum size is 50MB.', 'error');
    return;
  }
  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatSize(file.size);
  filePreview.style.display = 'flex';
  dropZone.style.display = 'none';
}

// ── Upload form ──
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('upload-error');
  errEl.textContent = '';

  const title = document.getElementById('ds-title').value.trim();
  const desc = document.getElementById('ds-desc').value.trim();
  const tags = document.getElementById('ds-tags').value.trim();

  if (!title) { errEl.textContent = 'Title is required.'; return; }
  if (!desc) { errEl.textContent = 'Description is required.'; return; }
  if (!selectedFile) { errEl.textContent = 'Please select a CSV or JSON file.'; return; }

  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Uploading…';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', desc);
  formData.append('tags', tags);
  formData.append('file', selectedFile);

  try {
    const result = await uploadFetch('/datasets', formData);
    const isAdmin = user?.role === 'admin';

    if (isAdmin) {
      showToast('Dataset published successfully! ✅', 'success');
      setTimeout(() => { window.location.href = `/dataset.html?id=${result.dataset._id}`; }, 900);
    } else {
      showToast('Dataset submitted! Awaiting admin approval. ⏳', 'success');
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 1200);
    }
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = '📤 Submit Dataset';
  }
});
