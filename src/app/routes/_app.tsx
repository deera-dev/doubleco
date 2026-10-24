import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { AppShell } from '@/features/shell/components/AppShell'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    if (!(await getCurrentSession())) throw redirect({ to: '/login' })
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
