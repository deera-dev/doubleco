import { createFileRoute } from '@tanstack/react-router'
import { MasterDataPage } from '@/features/master-data/components/MasterDataPage'

export const Route = createFileRoute('/_app/master-data')({
  component: MasterDataPage,
})
