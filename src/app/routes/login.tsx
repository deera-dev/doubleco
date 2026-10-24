import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await getCurrentSession()) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <AuthLayout
      title="Selamat datang"
      description="Gunakan username dan password akun Anda."
      credit="Created and designed by Denny Angesti Pratama"
      footer={
        <span className="text-muted-foreground">
          Punya kode aktivasi?{' '}
          <Link to="/aktivasi" className="font-medium text-link underline-offset-4 hover:underline">
            Aktifkan akun
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthLayout>
  )
}
