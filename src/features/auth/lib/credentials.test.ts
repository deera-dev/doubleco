import { describe, expect, it } from 'vitest'
import { normalizeUsername, usernameToEmail } from '@/features/auth/lib/credentials'

describe('credentials', () => {
  it('normalizes usernames to trimmed lowercase', () => {
    expect(normalizeUsername('  Koko ')).toBe('koko')
  })

  it('derives the synthetic auth email from the username', () => {
    expect(usernameToEmail(' KOKO')).toBe('koko@users.doubleco.internal')
  })
})
