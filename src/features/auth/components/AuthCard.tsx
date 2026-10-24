import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-xl bg-logo-surface px-4 py-3 shadow-xs">
            <img src="/logo.svg" alt="Logo doubleco" className="h-12 w-auto" />
          </div>
          <div className="space-y-1">
            <h1 className="font-semibold text-2xl text-foreground">{title}</h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs">{children}</div>
        {footer && <div className="text-center text-sm">{footer}</div>}
      </div>
    </main>
  )
}
