import { beforeEach, describe, expect, it } from 'vitest'
import { useCounterStore } from '@/features/counter/store'

describe('useCounterStore', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 })
  })

  it('increments the count', () => {
    useCounterStore.getState().increment()
    expect(useCounterStore.getState().count).toBe(1)
  })

  it('decrements the count', () => {
    useCounterStore.getState().increment()
    useCounterStore.getState().decrement()
    expect(useCounterStore.getState().count).toBe(0)
  })

  it('resets the count', () => {
    useCounterStore.getState().increment()
    useCounterStore.getState().increment()
    useCounterStore.getState().reset()
    expect(useCounterStore.getState().count).toBe(0)
  })
})
