import {
  Banknote,
  ClipboardList,
  HandCoins,
  House,
  type LucideIcon,
  Package,
  ScanLine,
  Scissors,
  Users,
} from 'lucide-react'

export interface NavigationItem {
  title: string
  shortTitle: string
  description: string
  icon: LucideIcon
  to?: '/' | '/karyawan' | '/master-data' | '/work-order'
}

export interface NavigationSection {
  title: string
  items: NavigationItem[]
}

export const homeItem: NavigationItem = {
  title: 'Beranda',
  shortTitle: 'Beranda',
  description: 'Ringkasan hari ini',
  icon: House,
  to: '/',
}

export const scanItem: NavigationItem = {
  title: 'Scan Kartu',
  shortTitle: 'Scan',
  description: 'Setor & periksa dalam sekali scan',
  icon: ScanLine,
}

export const workOrderItem: NavigationItem = {
  title: 'Work Order',
  shortTitle: 'WO',
  description: 'Buat, ubah, dan cetak kartu WO',
  icon: ClipboardList,
  to: '/work-order',
}

export const cuttingItem: NavigationItem = {
  title: 'Potong & Bagi',
  shortTitle: 'Potong',
  description: 'Hasil potong jadi kartu jahit',
  icon: Scissors,
}

export const payrollItem: NavigationItem = {
  title: 'Gajian',
  shortTitle: 'Gajian',
  description: 'Rekap otomatis & daftar transfer',
  icon: Banknote,
}

export const cashAdvanceItem: NavigationItem = {
  title: 'Kasbon',
  shortTitle: 'Kasbon',
  description: 'Pinjaman, cicilan, dan sisa',
  icon: HandCoins,
}

export const employeesItem: NavigationItem = {
  title: 'Karyawan',
  shortTitle: 'Karyawan',
  description: 'Aktif, tidak aktif, keluar',
  icon: Users,
  to: '/karyawan',
}

export const masterDataItem: NavigationItem = {
  title: 'Master Data',
  shortTitle: 'Master',
  description: 'Produk, bahan, warna, tarif',
  icon: Package,
  to: '/master-data',
}

export const navigationSections: NavigationSection[] = [
  { title: 'Utama', items: [homeItem, scanItem] },
  { title: 'Produksi', items: [workOrderItem, cuttingItem] },
  { title: 'Keuangan', items: [payrollItem, cashAdvanceItem] },
  { title: 'Data', items: [employeesItem, masterDataItem] },
]

export const moduleItems: NavigationItem[] = [
  workOrderItem,
  cuttingItem,
  payrollItem,
  cashAdvanceItem,
  employeesItem,
  masterDataItem,
]
