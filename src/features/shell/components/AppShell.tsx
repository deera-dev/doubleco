import type { ReactNode } from 'react'
import { useMe } from '@/features/auth/api/queries'
import { BrandLockup } from '@/features/shell/components/BrandMark'
import { BottomDock, MobileTopBar } from '@/features/shell/components/MobileChrome'
import { SidebarEntry } from '@/features/shell/components/NavigationEntry'
import { SidebarUserCard } from '@/features/shell/components/UserMenu'
import { navigationSections } from '@/features/shell/navigation'
import { describeError } from '@/shared/lib/error-messages'
import { toAppError } from '@/shared/types/errors'

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe()

  if (me.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(me.error))}
        </p>
      </div>
    )
  }

  if (!me.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-2 border-border-strong border-t-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="chrome sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-3 py-5 lg:flex">
        <div className="px-2">
          <BrandLockup />
        </div>
        <nav aria-label="Navigasi utama" className="mt-8 flex-1 space-y-6 overflow-y-auto">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-3 pb-1 font-medium text-subtle-foreground text-xs uppercase tracking-wider">
                {section.title}
              </p>
              {section.items.map((item) => (
                <SidebarEntry key={item.title} item={item} />
              ))}
            </div>
          ))}
        </nav>
        <SidebarUserCard me={me.data} />
      </aside>

      <div className="min-w-0 flex-1">
        <MobileTopBar me={me.data} />
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          {me.data.hasAccess ? (
            children
          ) : (
            <div className="surface rounded-3xl p-8 text-center">
              <p className="font-semibold">Akun belum diberi akses</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Hubungi admin agar akun Anda diberi peran.
              </p>
            </div>
          )}
        </main>
      </div>
      <BottomDock />
    </div>
  )
}
