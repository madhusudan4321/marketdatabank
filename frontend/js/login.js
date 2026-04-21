import { apiFetch, saveToken, saveUser, isLoggedIn, showToast } from './api.js';

// Redirect if already logged in
if (isLoggedIn()) window.location.href = '/';

// ── User Login ──
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-submit');
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Logging in…';

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value,
      }),
    });
    // Prevent admin from logging in via the regular user login form
    if (data.user.role === 'admin') {
      errEl.textContent = 'Please use the 🛡️ Admin tab to login as administrator.';
      return;
    }
    saveToken(data.token);
    saveUser(data.user);
    showToast(`Welcome back, ${data.user.name}!`, 'success');
    setTimeout(() => { window.location.href = '/'; }, 800);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login';
  }
});

// ── Register ──
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('reg-submit');
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const data = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    saveToken(data.token);
    saveUser(data.user);
    showToast(`Account created! Welcome, ${data.user.name}!`, 'success');
    setTimeout(() => { window.location.href = '/'; }, 800);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});

// ── Admin Login ──
document.getElementById('admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('admin-submit');
  const errEl = document.getElementById('admin-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = '⏳ Verifying…';

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('admin-email').value.trim(),
        password: document.getElementById('admin-password').value,
      }),
    });

    // Ensure only admin role is accepted here
    if (data.user.role !== 'admin') {
      errEl.textContent = 'Access denied. This portal is for the administrator only.';
      return;
    }

    saveToken(data.token);
    saveUser(data.user);
    showToast(`Welcome, ${data.user.name}! Admin access granted.`, 'success');
    setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '🛡️ Login as Admin';
  }
});
