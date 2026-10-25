import { createFileRoute } from '@tanstack/react-router'
import { ScanPage } from '@/features/scan/components/ScanPage'

export const Route = createFileRoute('/_app/scan')({
  component: ScanPage,
})
