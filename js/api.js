import { GRAPHQL_URL } from './config.js';
import { getToken, logout } from './auth.js';

export class AuthError extends Error {}

export async function graphql(query, variables = {}) {
  const token = getToken();
  if (!token) throw new AuthError('Not signed in.');

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401 || res.status === 403) {
    logout();
    throw new AuthError('Your session expired. Please sign in again.');
  }

  const json = await res.json().catch(() => null);

  if (!json) throw new Error('The server returned an unreadable response.');

  if (json.errors?.length) {
    if (isAuthFailure(json.errors[0])) {
      logout();
      throw new AuthError('Your session expired. Please sign in again.');
    }
    throw new Error(json.errors[0].message || 'Query failed.');
  }

  return json.data;
}

function isAuthFailure({ message = '', extensions }) {
  return ['invalid-jwt', 'access-denied', 'invalid-headers'].includes(extensions?.code)
    || /jwt|unauthor|invalid.*token/i.test(message)
    || /not found in type: 'query_root'/.test(message);
}
