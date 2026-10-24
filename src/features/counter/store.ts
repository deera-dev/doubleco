import { create } from 'zustand'

/**
 * Purity of Store: this store holds ONLY synchronous UI state for this
 * feature. No fetching, no Supabase calls, no async side effects —
 * server state belongs in `api/` hooks backed by TanStack Query. Keeping
 * stores this thin is what makes them trivial to unit test and reason
 * about (SRP).
 */
interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}))
