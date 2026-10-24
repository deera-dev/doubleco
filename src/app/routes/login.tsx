import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { AuthCard } from '@/features/auth/components/AuthCard'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await getCurrentSession()) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <AuthCard
      title="Masuk"
      description="Aplikasi Produksi Maryam"
      footer={
        <span className="text-muted-foreground">
          Punya kode aktivasi?{' '}
          <Link
            to="/aktivasi"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Aktifkan akun
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthCard>
  )
}
