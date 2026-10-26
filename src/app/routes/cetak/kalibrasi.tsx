import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '@/features/auth/api/session'
import { CalibrationPage } from '@/features/print-settings/CalibrationPage'

export const Route = createFileRoute('/cetak/kalibrasi')({
  beforeLoad: async () => {
    if (!(await getCurrentSession())) throw redirect({ to: '/login' })
  },
  component: CalibrationPage,
})
