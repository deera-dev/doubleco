import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { queryClient } from '@/shared/lib/query-client'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold text-(--color-text)">Page not found</h1>
      <p className="text-(--color-text-muted)">The page you're looking for doesn't exist.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold text-(--color-danger)">Something went wrong</h1>
      <p className="text-(--color-text-muted)">
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
            <h1 className="text-2xl font-semibold text-(--color-danger)">Unexpected error</h1>
            <p className="text-(--color-text-muted)">{error.message}</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-(--radius-md) bg-(--color-brand-600) px-4 py-2 text-white hover:bg-(--color-brand-700)"
            >
              Try again
            </button>
          </div>
        )}
      >
        <Outlet />
      </ErrorBoundary>
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </>
      )}
    </QueryClientProvider>
  )
}
