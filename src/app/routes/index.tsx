import { createFileRoute } from '@tanstack/react-router'
import { Counter } from '@/features/counter/components/Counter'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">doubleco</CardTitle>
          <CardDescription className="text-center">
            Vite + TanStack Router/Query + Zustand + Zod + shadcn/ui + Supabase scaffold. The
            counter below is wired to a Zustand store under{' '}
            <code className="font-mono text-sm">src/features/counter</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Counter />
        </CardContent>
      </Card>
    </main>
  )
}
