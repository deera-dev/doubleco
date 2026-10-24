export const USERNAME_EMAIL_DOMAIN = 'users.doubleco.internal'

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`
}
