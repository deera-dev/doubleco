import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { NavigationItem } from '@/features/shell/navigation'
import { cn } from '@/shared/lib/utils'

export function announceSoon(item: NavigationItem) {
  toast(`${item.title} segera hadir`, { description: item.description })
}

export function SidebarEntry({ item }: { item: NavigationItem }) {
  const content = (
    <>
      <item.icon className="size-4.5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
      <span className="flex-1 truncate">{item.title}</span>
      {!item.to && <span className="text-subtle-foreground text-xs">Segera</span>}
    </>
  )
  const baseClass =
    'group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-all duration-200 active:scale-98'

  if (item.to) {
    return (
      <Link
        to={item.to}
        className={cn(
          baseClass,
          'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        )}
        activeProps={{ className: 'bg-surface-hover text-foreground shadow-xs' }}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => announceSoon(item)}
      className={cn(
        baseClass,
        'text-muted-foreground/70 hover:bg-surface-hover hover:text-muted-foreground',
      )}
    >
      {content}
    </button>
  )
}
