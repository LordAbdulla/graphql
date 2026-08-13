export const PROFILE = `
query Profile($userId: Int!, $path: String!, $excludePath: String!) {
  user {
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
      path: { _like: $path, _nlike: $excludePath }
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
      path: { _like: $path, _nlike: $excludePath }
    }
    order_by: { amount: desc }
    limit: 1
  ) {
    amount
  }
}`;

export const AUDIT_TOTALS = `
query AuditTotals($userId: Int!) {
  up: transaction(where: { userId: { _eq: $userId }, type: { _eq: "up" } }) {
    amount
  }
  down: transaction(where: { userId: { _eq: $userId }, type: { _eq: "down" } }) {
    amount
  }
}`;

export const XP_PATHS = `
query XpPaths($userId: Int!) {
  transaction(
    where: { userId: { _eq: $userId }, type: { _eq: "xp" } }
    limit: 500
  ) {
    path
  }
}`;
