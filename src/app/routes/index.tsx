import { createFileRoute } from '@tanstack/react-router'
import { Counter } from '@/features/counter/components/Counter'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold text-(--color-text)">doubleco</h1>
      <p className="max-w-md text-center text-(--color-text-muted)">
        Vite + TanStack Router/Query + Zustand + Zod + Tailwind + Supabase scaffold. The counter
        below is wired to a Zustand store under{' '}
        <code className="font-mono text-sm">src/features/counter</code>.
      </p>
      <Counter />
    </main>
  )
}
