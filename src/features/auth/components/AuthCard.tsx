import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
  credit?: ReactNode
}

export function AuthCard({ title, description, children, footer, credit }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pt-10 pb-6">
      <div className="my-auto w-full max-w-sm space-y-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="sheen-metal rounded-2xl px-5 py-3.5">
            <img src="/logo.svg" alt="DoubleCo" className="h-16 w-auto" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-metal font-semibold text-3xl tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <div className="glass rounded-2xl p-5 sm:p-6">{children}</div>
        {footer && <div className="text-center text-sm">{footer}</div>}
      </div>
      {credit && (
        <footer className="mt-10 text-center text-muted-foreground/70 text-xs tracking-wide">
          {credit}
        </footer>
      )}
    </main>
  )
}
