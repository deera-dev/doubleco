import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useSignOut } from '@/features/auth/api/mutations'
import type { Me } from '@/features/auth/api/schema'
import { initialsOf, roleLabel } from '@/features/shell/lib/roles'
import { cn } from '@/shared/lib/utils'

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'sheen-metal flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-secondary-foreground text-xs',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

export function useSignOutAndLeave() {
  const navigate = useNavigate()
  const signOut = useSignOut()
  return {
    isPending: signOut.isPending,
    leave: () => signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) }),
  }
}

export function SidebarUserCard({ me }: { me: Me }) {
  const { leave, isPending } = useSignOutAndLeave()

  return (
    <div className="surface flex items-center gap-3 rounded-2xl p-2.5">
      <Avatar name={me.displayName} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-medium text-sm">{me.displayName}</p>
        <p className="truncate text-muted-foreground text-xs">{roleLabel(me.role)}</p>
      </div>
      <button
        type="button"
        onClick={leave}
        disabled={isPending}
        aria-label="Keluar"
        className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}
