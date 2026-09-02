import { MODULE_PATH, PISCINE_JS_EXCLUDE_PATH, PISCINE_RUST_EXCLUDE_PATH } from './config.js';

export const PROFILE = `
query Profile($userId: Int!) {
  user(where: { id: { _eq: $userId } }) {
    id
    login
    firstName
    lastName
    email
    createdAt
    campus
    auditRatio
    totalUp
    totalDown
  }

  xp: transaction(
    where: {
      userId: { _eq: $userId }
      type: { _eq: "xp" }
      path: { _like: "/bahrain/bh-module%" }
    }
    order_by: { createdAt: asc }
  ) {
    id
    amount
    createdAt
    path
    object {
      id
      name
      type
    }
  }

  level: transaction(
    where: {
      userId: { _eq: $userId }
      type: { _eq: "level" }
      path: { _like: "/bahrain/bh-module%" }
    }
    order_by: { amount: desc }
    limit: 1
  ) {
    amount
    path
  }
}
`;
