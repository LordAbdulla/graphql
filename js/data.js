import { graphql, AuthError } from './api.js';
import { getUserId } from './auth.js';
import { MODULE_PATH, PISCINE_JS_EXCLUDE_PATH } from './config.js';
import * as Q from './queries.js';

const optional = (promise) => promise.catch(() => null);

export async function loadProfileData() {
  const userId = getUserId();
  if (userId == null) throw new AuthError('Could not read your user ID. Please sign in again.');

  const vars = { userId, path: MODULE_PATH, excludePath: PISCINE_JS_EXCLUDE_PATH };

  const profile = await graphql(Q.PROFILE, vars);
  const user = profile.user?.[0];
  if (user?.id == null) throw new Error('No user returned for this token.');

  const transactions = profile.xp ?? [];

  return {
    user,
    level: profile.level?.[0]?.amount ?? null,
    totalXp: sumAmounts(transactions),
    xpTimeline: buildTimeline(transactions),
    xpByProject: groupByProject(transactions),
    audits: await loadAudits(user, userId),
    notice: transactions.length ? null : await diagnosePath(userId),
  };
}

async function loadAudits(stats, userId) {
  if (stats?.totalUp != null || stats?.totalDown != null) {
    const up = stats.totalUp ?? 0;
    const down = stats.totalDown ?? 0;
    return { up, down, ratio: stats.auditRatio ?? (down > 0 ? up / down : null) };
  }

  const totals = await optional(graphql(Q.AUDIT_TOTALS, { userId }));
  if (!totals) return { up: null, down: null, ratio: null };

  const up = sumAmounts(totals.up);
  const down = sumAmounts(totals.down);
  return { up, down, ratio: down > 0 ? up / down : null };
}

async function diagnosePath(userId) {
  const data = await optional(graphql(Q.XP_PATHS, { userId }));
  const rows = data?.transaction ?? [];
  if (!rows.length) return null;

  const prefixes = [...new Set(rows.map((t) => topLevel(t.path)))].filter(Boolean).sort();
  return `No XP matched the configured path "${MODULE_PATH}". ` +
    `Paths found on this account: ${prefixes.join(', ')}. Update MODULE_PATH in js/config.js.`;
}

function topLevel(path) {
  const segments = segmentsOf(path).slice(0, 2);
  return segments.length ? `/${segments.join('/')}` : '';
}

const sumAmounts = (rows = []) => rows.reduce((total, t) => total + t.amount, 0);

function buildTimeline(transactions) {
  let running = 0;
  return transactions
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((t) => {
      running += t.amount;
      return {
        date: new Date(t.createdAt),
        amount: t.amount,
        total: running,
        name: nameOf(t),
      };
    });
}

function groupByProject(transactions) {
  const totals = new Map();
  for (const t of transactions) {
    const name = nameOf(t);
    totals.set(name, (totals.get(name) ?? 0) + t.amount);
  }
  return [...totals]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

const segmentsOf = (path) => (path ?? '').split('/').filter(Boolean);

const nameOf = (t) => t.object?.name ?? segmentsOf(t.path).pop() ?? 'unknown';

export function formatXp(amount) {
  if (amount == null) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} MB`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} kB`;
  return `${amount} B`;
}

export const formatDate = (date) =>
  date instanceof Date && !isNaN(date) ? date.toLocaleDateString() : '—';
