import { createFileRoute, Link } from '@tanstack/react-router'
import { ActivationForm } from '@/features/auth/components/ActivationForm'
import { AuthLayout } from '@/features/auth/components/AuthLayout'

export const Route = createFileRoute('/aktivasi')({
  component: ActivationPage,
})

function ActivationPage() {
  return (
    <AuthLayout
      title="Aktivasi Akun"
      description="Masukkan kode aktivasi lalu buat password Anda sendiri."
      footer={
        <Link to="/login" className="font-medium text-link underline-offset-4 hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ActivationForm />
    </AuthLayout>
  )
}
