import { SIGNIN_URL } from './config.js';

const TOKEN_KEY = 'jwt';

function toBase64(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function getUserId(token = getToken()) {
  const claims = token && decodeToken(token);
  if (!claims) return null;
  const hasura = claims['https://hasura.io/jwt/claims'] || {};
  const id = hasura['x-hasura-user-id'] ?? claims.sub;
  return id == null ? null : Number(id);
}

function isExpired(token) {
  const claims = decodeToken(token);
  if (!claims || !claims.exp) return false;
  return Date.now() >= claims.exp * 1000;
}

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

export function isAuthenticated() {
  return getToken() !== null;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function signIn(identifier, password) {
  let res;
  try {
    res = await fetch(SIGNIN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${toBase64(`${identifier}:${password}`)}` },
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }

  const body = (await res.text()).trim();

  if (!res.ok) {
    throw new Error(extractError(body) || 'Invalid username or password.');
  }

  const token = body.replace(/^"|"$/g, '');
  if (!token.includes('.')) {
    throw new Error('Unexpected response from the sign-in service.');
  }

  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

function extractError(body) {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === 'string') return parsed;
    return parsed.error || parsed.message || null;
  } catch {
    return null;
  }
}
