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
    <div className="flex min-h-dvh flex-col">
      <header className="glass-strong sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo-mark.svg" alt="DoubleCo" className="h-8 w-auto shrink-0" />
            <div className="min-w-0 border-l pl-3 leading-tight">
              <p className="truncate font-semibold text-foreground text-sm">
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {me.isError && (
          <p role="alert" className="text-destructive text-sm">
            {describeError(toAppError(me.error))}
          </p>
        )}
        {me.data && !me.data.hasAccess ? (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="font-semibold text-foreground">Akun belum diberi akses</p>
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
