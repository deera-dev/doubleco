import type { AppRole } from '@/features/auth/api/schema'

const roleLabels: Record<AppRole, string> = {
  master: 'Developer',
  production_head: 'Kepala Produksi',
  finishing_head: 'Kepala Finishing',
  warehouse: 'Gudang',
  owner: 'Owner',
  cutter: 'Tukang Potong',
  tailor: 'Penjahit',
}

export function roleLabel(role: AppRole | null): string {
  return role ? roleLabels[role] : 'Belum ada peran'
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}
