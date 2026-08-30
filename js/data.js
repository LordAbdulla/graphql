import { graphql, AuthError } from './api.js';
import { getUserId } from './auth.js';
import * as Q from './queries.js';

const optional = (promise) => promise.catch(() => null);

export async function loadProfileData() {
  const userId = getUserId();
  if (userId == null) {
    throw new AuthError('Could not read your user ID. Please sign in again.');
  }

  const profile = await graphql(Q.PROFILE, { userId });
  const user = profile.user?.[0];
  if (user?.id == null) {
    throw new Error('No user returned for this token.');
  }

  const rawTransactions = profile.xp ?? [];
  const transactions = deduplicateXp(rawTransactions);

  const currentLevel = profile.level?.[0]?.amount ?? null;

  return {
    user,
    level: currentLevel,
    totalXp: sumAmounts(transactions),
    xpTimeline: buildTimeline(transactions),
    xpByProject: groupByProject(transactions),
    audits: await loadAudits(user, userId),
  };
}

function deduplicateXp(transactions) {
  const seen = new Map();
  for (const t of transactions) {
    if (
      t.path.includes('/piscine-js-attemp') ||
      t.path.includes('/piscine-go/')
    ) {
      continue;
    }
    const name = nameOf(t);
    if (!seen.has(name) || seen.get(name).amount < t.amount) {
      seen.set(name, t);
    }
  }
  return Array.from(seen.values()).sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
}

async function loadAudits(user, userId) {
  let up = user?.totalUp;
  let down = user?.totalDown;

  if (up == null || down == null) {
    const totals = await optional(graphql(Q.AUDIT_TOTALS, { userId }));
    if (totals) {
      up = sumAmounts(totals.up);
      down = sumAmounts(totals.down);
    }
  }

  up = up ?? 0;
  down = down ?? 0;

  const ratio = down > 0 ? up / down : up > 0 ? up : 0;

  return { up, down, ratio };
}

const sumAmounts = (rows = []) =>
  rows.reduce((total, t) => total + t.amount, 0);

function buildTimeline(transactions) {
  let running = 0;
  return transactions.map((t) => {
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
