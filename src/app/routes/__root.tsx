import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { Button } from '@/shared/components/ui/button'
import { Toaster } from '@/shared/components/ui/sonner'
import { queryClient } from '@/shared/lib/query-client'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-semibold text-2xl text-foreground">Page not found</h1>
      <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-semibold text-2xl text-destructive">Something went wrong</h1>
      <p className="text-muted-foreground">
        {error instanceof Error ? error.message : 'An unexpected error occurred'}
      </p>
    </div>
  ),
})

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <h1 className="font-semibold text-2xl text-destructive">Unexpected error</h1>
            <p className="text-muted-foreground">{error.message}</p>
            <Button type="button" onClick={reset}>
              Try again
            </Button>
          </div>
        )}
      >
        <Outlet />
      </ErrorBoundary>
      <Toaster position="top-right" />
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </>
      )}
    </QueryClientProvider>
  )
}
