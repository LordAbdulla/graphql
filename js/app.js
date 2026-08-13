import { signIn, logout, isAuthenticated } from './auth.js';
import { AuthError } from './api.js';
import { loadProfileData, formatXp, formatDate } from './data.js';
import { xpOverTime, xpByProject, auditRatio } from './charts.js';

const el = (id) => document.getElementById(id);

const loginView = el('login-view');
const profileView = el('profile-view');
const loginForm = el('login-form');
const submitBtn = el('login-submit');
const loader = el('loader');

function showLogin(message) {
  profileView.hidden = true;
  loginView.hidden = false;
  setMessage('login-error', message);
  loginForm.reset();
  el('identifier').focus();
}

function showProfile() {
  loginView.hidden = true;
  profileView.hidden = false;
}

function setMessage(id, message) {
  const box = el(id);
  box.textContent = message || '';
  box.hidden = !message;
}

function setBusy(busy) {
  loader.hidden = !busy;
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? 'Signing in…' : 'Sign in';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('login-error', null);

  const identifier = el('identifier').value.trim();
  const password = el('password').value;

  if (!identifier || !password) {
    setMessage('login-error', 'Enter both your username/email and password.');
    return;
  }

  setBusy(true);
  try {
    await signIn(identifier, password);
    showProfile();
    await loadProfile();
  } catch (err) {
    setMessage('login-error', err.message);
  } finally {
    setBusy(false);
  }
});

el('logout-btn').addEventListener('click', () => {
  logout();
  showLogin();
});

async function loadProfile() {
  setBusy(true);
  setMessage('profile-error', null);
  try {
    renderProfile(await loadProfileData());
  } catch (err) {
    if (err instanceof AuthError) showLogin(err.message);
    else setMessage('profile-error', `Could not load your profile: ${err.message}`);
  } finally {
    setBusy(false);
  }
}

function renderProfile(profile) {
  const { user, audits } = profile;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');

  if (profile.notice) setMessage('profile-error', profile.notice);

  el('profile-name').textContent = fullName || user.login;
  el('profile-login').textContent = `@${user.login}`;
  el('avatar').textContent = initials(fullName || user.login);

  renderStats({
    'Total XP': formatXp(profile.totalXp),
    Level: profile.level ?? '—',
    'Audit ratio': audits.ratio == null ? '—' : audits.ratio.toFixed(2),
  });

  renderKeyValues(el('identity-list'), {
    'User ID': user.id,
    Login: user.login,
    Email: user.email ?? '—',
    Campus: user.campus ?? '—',
    'Member since': formatDate(new Date(user.createdAt)),
  });

  renderKeyValues(el('audit-list'), {
    'Audits done': formatXp(audits.up),
    'Audits received': formatXp(audits.down),
    Ratio: audits.ratio == null ? '—' : audits.ratio.toFixed(2),
  });

  xpOverTime(el('chart-xp'), profile.xpTimeline);
  xpByProject(el('chart-projects'), profile.xpByProject);
  auditRatio(el('chart-audits'), audits);
}

const make = (tag, value) =>
  Object.assign(document.createElement(tag), { textContent: String(value) });

function renderStats(pairs) {
  const cards = Object.entries(pairs).map(([label, value]) => {
    const card = make('div', '');
    card.className = 'stat';
    card.append(make('strong', value), make('span', label));
    return card;
  });
  el('stat-cards').replaceChildren(...cards);
}

function renderKeyValues(container, pairs) {
  const rows = Object.entries(pairs).flatMap(([key, value]) => [make('dt', key), make('dd', value)]);
  container.replaceChildren(...rows);
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

if (isAuthenticated()) {
  showProfile();
  loadProfile();
} else {
  showLogin();
}
