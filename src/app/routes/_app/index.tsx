import { createFileRoute } from '@tanstack/react-router'
import { useMe } from '@/features/auth/api/queries'
import { HomeDashboard } from '@/features/shell/components/HomeDashboard'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

function HomePage() {
  const me = useMe()
  return <HomeDashboard displayName={me.data?.displayName ?? ''} now={new Date()} />
}
