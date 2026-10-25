import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="surface flex animate-rise flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-border-strong bg-background/60 text-metal-200">
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="mx-auto max-w-sm text-muted-foreground text-sm">{description}</p>
      </div>
      {action}
    </div>
  )
}
