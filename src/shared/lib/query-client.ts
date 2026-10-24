import { QueryClient } from '@tanstack/react-query'

/**
 * The single TanStack Query client for the app.
 *
 * TanStack Query owns ALL server state (anything that lives in Supabase).
 * Zustand stores must never duplicate it — see `shared/stores` and the
 * "Purity of Store" rule in the README. Defaults below favor fewer
 * accidental refetches; override per-query when a feature needs to.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
