import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useCounterStore } from '@/features/counter/store'
import { Button } from '@/shared/components/ui/button'

export function Counter() {
  const count = useCounterStore((state) => state.count)
  const increment = useCounterStore((state) => state.increment)
  const decrement = useCounterStore((state) => state.decrement)
  const reset = useCounterStore((state) => state.reset)

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted p-4">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={decrement}
        aria-label="Decrement"
      >
        <Minus />
      </Button>
      <span className="min-w-8 text-center font-mono text-foreground text-lg">{count}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={increment}
        aria-label="Increment"
      >
        <Plus />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label="Reset">
        <RotateCcw />
      </Button>
    </div>
  )
}
