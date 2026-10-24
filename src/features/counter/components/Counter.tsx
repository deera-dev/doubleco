import { useCounterStore } from '@/features/counter/store'

export function Counter() {
  const count = useCounterStore((state) => state.count)
  const increment = useCounterStore((state) => state.increment)
  const decrement = useCounterStore((state) => state.decrement)
  const reset = useCounterStore((state) => state.reset)

  return (
    <div className="flex items-center gap-3 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface-muted) p-4">
      <button
        type="button"
        onClick={decrement}
        className="rounded-(--radius-sm) border border-(--color-border) px-3 py-1 text-(--color-text) hover:bg-(--color-surface)"
      >
        -
      </button>
      <span className="min-w-8 text-center font-mono text-lg text-(--color-text)">{count}</span>
      <button
        type="button"
        onClick={increment}
        className="rounded-(--radius-sm) border border-(--color-border) px-3 py-1 text-(--color-text) hover:bg-(--color-surface)"
      >
        +
      </button>
      <button
        type="button"
        onClick={reset}
        className="ml-2 rounded-(--radius-sm) px-3 py-1 text-(--color-text-muted) hover:text-(--color-text)"
      >
        Reset
      </button>
    </div>
  )
}
