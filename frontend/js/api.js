// ── Token helpers ──
export const saveToken = (token) => localStorage.setItem('md_token', token);
export const getToken = () => localStorage.getItem('md_token');
export const removeToken = () => localStorage.removeItem('md_token');

export const saveUser = (user) => localStorage.setItem('md_user', JSON.stringify(user));
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('md_user')); } catch { return null; }
};
export const removeUser = () => localStorage.removeItem('md_user');

export const isLoggedIn = () => !!getToken();

export const logout = () => {
  removeToken();
  removeUser();
  window.location.href = '/login.html';
};

// ── Fetch helpers ──
const BASE = 'https://marketdatabank-backend.onrender.com/api';

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export async function authFetch(endpoint, options = {}) {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }
  return apiFetch(endpoint, options);
}

export async function uploadFetch(endpoint, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${endpoint}`, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Upload failed (${res.status})`);
  return data;
}

// ── Toast notifications ──
let toastContainer = null;
const getToastContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

export function showToast(message, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || '🔔'}</span><span>${message}</span>`;
  getToastContainer().appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// ── Navbar helpers ──
export function renderNav() {
  const user = getUser();
  const usernameEl = document.getElementById('nav-username');
  const logoutBtn = document.getElementById('nav-logout');
  const loginLink = document.getElementById('nav-login');
  const uploadLink = document.getElementById('nav-upload');
  const dashLink = document.getElementById('nav-dash');

  if (user) {
    if (usernameEl) usernameEl.textContent = user.name;
    if (logoutBtn) { logoutBtn.style.display = 'inline-flex'; logoutBtn.addEventListener('click', logout); }
    if (loginLink) loginLink.style.display = 'none';
    if (uploadLink) uploadLink.style.display = 'inline-flex';
    if (dashLink) dashLink.style.display = 'inline-flex';
  } else {
    if (usernameEl) usernameEl.textContent = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginLink) loginLink.style.display = 'inline-flex';
    if (uploadLink) uploadLink.style.display = 'none';
    if (dashLink) dashLink.style.display = 'none';
  }
}

// ── Utility ──
export function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
