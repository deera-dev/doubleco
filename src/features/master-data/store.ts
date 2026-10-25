import { create } from 'zustand'
import type { Fabric, Pattern, Product, Size } from '@/features/master-data/api/schema'

export type MasterDataTab = 'products' | 'patterns' | 'fabrics' | 'sizes' | 'wages'

export type MasterDataEditor =
  | { kind: 'closed' }
  | { kind: 'product'; product: Product | null }
  | { kind: 'fabric'; fabric: Fabric | null }
  | { kind: 'size'; size: Size | null }
  | { kind: 'pattern'; pattern: Pattern | null }
  | { kind: 'wage_rate' }

interface MasterDataUiState {
  tab: MasterDataTab
  editor: MasterDataEditor
  setTab: (tab: MasterDataTab) => void
  openEditor: (editor: MasterDataEditor) => void
  closeEditor: () => void
}

export const useMasterDataUiStore = create<MasterDataUiState>((set) => ({
  tab: 'products',
  editor: { kind: 'closed' },
  setTab: (tab) => set({ tab }),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: { kind: 'closed' } }),
}))
