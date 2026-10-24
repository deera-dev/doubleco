import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useAuthStateSync } from '@/features/auth/api/session'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { Button } from '@/shared/components/ui/button'
import { Toaster } from '@/shared/components/ui/sonner'
import { queryClient } from '@/shared/lib/query-client'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-semibold text-2xl text-foreground">Halaman tidak ditemukan</h1>
      <p className="text-muted-foreground">Halaman yang Anda cari tidak ada.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-semibold text-2xl text-destructive">Terjadi kesalahan</h1>
      <p className="text-muted-foreground">
        {error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak terduga'}
      </p>
    </div>
  ),
})

function RootComponent() {
  useAuthStateSync()

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
            <h1 className="font-semibold text-2xl text-destructive">Terjadi kesalahan</h1>
            <p className="text-muted-foreground">{error.message}</p>
            <Button type="button" onClick={reset}>
              Coba lagi
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
