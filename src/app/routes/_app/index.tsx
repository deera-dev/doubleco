import { createFileRoute } from '@tanstack/react-router'
import { useMe } from '@/features/auth/api/queries'
import { HomeMenu } from '@/features/shell/components/HomeMenu'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

function HomePage() {
  const me = useMe()
  return <HomeMenu displayName={me.data?.displayName ?? ''} />
}
