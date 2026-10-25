const STORAGE_KEY = 'doubleco.session-expires-at'
const DAY = 24 * 60 * 60 * 1000

export const SESSION_LENGTH = {
  remembered: 30 * DAY,
  shared: 12 * 60 * 60 * 1000,
}

export function sessionDeadline(remember: boolean, now: number): number {
  return now + (remember ? SESSION_LENGTH.remembered : SESSION_LENGTH.shared)
}

function read(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function write(deadline: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(deadline))
  } catch {}
}

export function startSessionClock(remember: boolean, now = Date.now()) {
  write(sessionDeadline(remember, now))
}

export function clearSessionClock() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function isSessionExpired(now = Date.now()): boolean {
  const deadline = read()
  if (deadline === null) {
    startSessionClock(true, now)
    return false
  }
  return now >= deadline
}
