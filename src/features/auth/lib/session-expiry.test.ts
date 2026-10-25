import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionClock,
  isSessionExpired,
  SESSION_LENGTH,
  sessionDeadline,
  startSessionClock,
} from '@/features/auth/lib/session-expiry'

const now = Date.UTC(2026, 9, 25, 8, 0)

describe('session expiry', () => {
  beforeEach(() => clearSessionClock())

  it('keeps a remembered login for 30 days', () => {
    expect(sessionDeadline(true, now) - now).toBe(30 * 24 * 60 * 60 * 1000)
    startSessionClock(true, now)
    expect(isSessionExpired(now + SESSION_LENGTH.remembered - 1)).toBe(false)
    expect(isSessionExpired(now + SESSION_LENGTH.remembered)).toBe(true)
  })

  it('ends a shared-device login after 12 hours', () => {
    startSessionClock(false, now)
    expect(isSessionExpired(now + 11 * 60 * 60 * 1000)).toBe(false)
    expect(isSessionExpired(now + 12 * 60 * 60 * 1000)).toBe(true)
  })

  it('gives sessions from before this feature a fresh 30 days', () => {
    expect(isSessionExpired(now)).toBe(false)
    expect(isSessionExpired(now + SESSION_LENGTH.remembered)).toBe(true)
  })
})
