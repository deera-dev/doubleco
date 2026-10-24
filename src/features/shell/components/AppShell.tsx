import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSignOut } from '@/features/auth/api/mutations'
import { useMe } from '@/features/auth/api/queries'
import { Button } from '@/shared/components/ui/button'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const me = useMe()
  const signOut = useSignOut()

  const handleSignOut = () =>
    signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md bg-logo-surface px-2 py-1">
              <img src="/logo.svg" alt="Logo doubleco" className="h-6 w-auto" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-medium text-foreground text-sm">
                {me.data?.displayName ?? '…'}
              </p>
              <p className="truncate text-muted-foreground text-xs">Produksi Maryam</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signOut.isPending}
          >
            <LogOut />
            Keluar
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {me.isError && (
          <p role="alert" className="text-destructive text-sm">
            {describeError(toAppError(me.error))}
          </p>
        )}
        {me.data && !me.data.hasAccess ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="font-medium text-foreground">Akun belum diberi akses</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Hubungi admin agar akun Anda diberi peran.
            </p>
          </div>
        ) : (
          me.data && children
        )}
      </main>
    </div>
  )
}
