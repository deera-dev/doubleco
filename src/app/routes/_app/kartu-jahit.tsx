import { createFileRoute } from '@tanstack/react-router'
import { CuttingBoardPage } from '@/features/sewing-cards/components/CuttingBoardPage'

export const Route = createFileRoute('/_app/kartu-jahit')({
  component: CuttingBoardPage,
})
