import { Link } from '@tanstack/react-router'
import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import type { Me } from '@/features/auth/api/schema'
import { BrandLockup } from '@/features/shell/components/BrandMark'
import { announceSoon } from '@/features/shell/components/NavigationEntry'
import { Avatar, useSignOutAndLeave } from '@/features/shell/components/UserMenu'
import { roleLabel } from '@/features/shell/lib/roles'
import {
  homeItem,
  type NavigationItem,
  navigationSections,
  payrollItem,
  scanItem,
  workOrderItem,
} from '@/features/shell/navigation'
import { cn } from '@/shared/lib/utils'

export function MobileTopBar({ me }: { me: Me }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { leave, isPending } = useSignOutAndLeave()

  return (
    <header className="chrome sticky top-0 z-30 border-b lg:hidden">
      <div className="flex h-16 items-center justify-between gap-3 px-4">
        <BrandLockup />
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-label="Menu akun"
            className="rounded-full"
          >
            <Avatar name={me.displayName} />
          </button>
          {isMenuOpen && (
            <div className="surface chrome absolute top-12 right-0 w-56 origin-top-right animate-pop rounded-2xl bg-popover/95 p-2">
              <div className="px-2.5 py-2 leading-tight">
                <p className="truncate font-medium text-sm">{me.displayName}</p>
                <p className="truncate text-muted-foreground text-xs">{roleLabel(me.role)}</p>
              </div>
              <button
                type="button"
                onClick={leave}
                disabled={isPending}
                className="flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-destructive text-sm hover:bg-surface-hover disabled:opacity-50"
              >
                <LogOut className="size-4" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function DockEntry({ item }: { item: NavigationItem }) {
  const className =
    'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-all duration-200 active:scale-90'
  const content = (
    <>
      <item.icon className="size-5" />
      <span className="leading-none">{item.shortTitle}</span>
    </>
  )

  if (item.to) {
    return (
      <Link
        to={item.to}
        className={className}
        activeOptions={{ exact: item.to === '/' }}
        activeProps={{ className: 'text-foreground' }}
      >
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={() => announceSoon(item)} className={className}>
      {content}
    </button>
  )
}

const moreItemClass =
  'flex h-12 items-center gap-2.5 rounded-2xl px-3 text-left text-muted-foreground text-sm transition-colors hover:bg-surface-hover hover:text-foreground active:scale-97'

export function BottomDock() {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreItems = navigationSections
    .flatMap((section) => section.items)
    .filter((item) => ![homeItem, scanItem, workOrderItem, payrollItem].includes(item))

  return (
    <nav
      aria-label="Navigasi utama"
      className="hide-with-keyboard fixed inset-x-0 bottom-0 z-30 px-3 pb-3 lg:hidden"
    >
      {isMoreOpen && (
        <div className="surface chrome mb-2 grid origin-bottom animate-pop grid-cols-2 gap-1 rounded-3xl bg-popover/95 p-2">
          {moreItems.map((item) =>
            item.to ? (
              <Link
                key={item.title}
                to={item.to}
                onClick={() => setIsMoreOpen(false)}
                className={moreItemClass}
                activeProps={{ className: 'bg-surface-hover text-foreground' }}
              >
                <item.icon className="size-4.5" />
                {item.title}
              </Link>
            ) : (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  setIsMoreOpen(false)
                  announceSoon(item)
                }}
                className={cn(moreItemClass, 'text-subtle-foreground')}
              >
                <item.icon className="size-4.5" />
                {item.title}
              </button>
            ),
          )}
        </div>
      )}
      <div className="surface chrome flex items-stretch rounded-3xl bg-popover/90 px-1">
        <DockEntry item={homeItem} />
        <DockEntry item={workOrderItem} />
        <div className="flex flex-1 items-start justify-center">
          <span className="-mt-5 animate-pulse-ring rounded-2xl">
            <button
              type="button"
              onClick={() => announceSoon(scanItem)}
              aria-label={scanItem.title}
              className="sheen-primary flex size-14 items-center justify-center rounded-2xl text-primary-foreground outline-4 outline-background transition-transform duration-200 active:scale-90"
            >
              <scanItem.icon className="size-6" />
            </button>
          </span>
        </div>
        <DockEntry item={payrollItem} />
        <button
          type="button"
          onClick={() => setIsMoreOpen((open) => !open)}
          aria-expanded={isMoreOpen}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground',
            isMoreOpen && 'text-foreground',
          )}
        >
          <Menu className="size-5" />
          <span className="leading-none">Lainnya</span>
        </button>
      </div>
    </nav>
  )
}
