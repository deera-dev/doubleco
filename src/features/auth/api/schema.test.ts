import { describe, expect, it } from 'vitest'
import { activationFormSchema, loginFormSchema } from '@/features/auth/api/schema'

describe('loginFormSchema', () => {
  it('lowercases and trims the username', () => {
    expect(
      loginFormSchema.parse({ username: ' Koko ', password: 'x', remember: true }).username,
    ).toBe('koko')
  })

  it('rejects usernames with spaces or symbols', () => {
    expect(
      loginFormSchema.safeParse({ username: 'ko ko', password: 'x', remember: true }).success,
    ).toBe(false)
  })
})

describe('activationFormSchema', () => {
  const valid = {
    username: 'koko',
    code: 'ab12cd34',
    password: 'rahasia123',
    confirmPassword: 'rahasia123',
  }

  it('uppercases the activation code', () => {
    expect(activationFormSchema.parse(valid).code).toBe('AB12CD34')
  })

  it('requires the confirmation to match', () => {
    const result = activationFormSchema.safeParse({ ...valid, confirmPassword: 'berbeda123' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('requires at least 8 password characters', () => {
    const result = activationFormSchema.safeParse({
      ...valid,
      password: 'pendek',
      confirmPassword: 'pendek',
    })
    expect(result.success).toBe(false)
  })
})
