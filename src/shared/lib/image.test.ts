import { describe, expect, it } from 'vitest'
import { scaledSize } from '@/shared/lib/image'

describe('scaledSize', () => {
  it('shrinks the longest edge to the limit', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('keeps small photos as they are', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
