import { createFileRoute, Link } from '@tanstack/react-router'
import { ActivationForm } from '@/features/auth/components/ActivationForm'
import { AuthCard } from '@/features/auth/components/AuthCard'

export const Route = createFileRoute('/aktivasi')({
  component: ActivationPage,
})

function ActivationPage() {
  return (
    <AuthCard
      title="Aktivasi Akun"
      description="Masukkan kode aktivasi lalu buat password Anda sendiri."
      footer={
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ActivationForm />
    </AuthCard>
  )
}
