import {
  Banknote,
  ClipboardList,
  FileSpreadsheet,
  HandCoins,
  House,
  type LucideIcon,
  Package,
  Ruler,
  ScanLine,
  Scissors,
  Users,
} from 'lucide-react'

export interface NavigationItem {
  title: string
  shortTitle: string
  description: string
  icon: LucideIcon
  to?:
    | '/'
    | '/scan'
    | '/karyawan'
    | '/master-data'
    | '/work-order'
    | '/kartu-jahit'
    | '/gajian'
    | '/kasbon'
    | '/laporan'
    | '/cetak/kalibrasi'
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
  description: 'Catat setoran kartu jahit',
  icon: ScanLine,
  to: '/scan',
}

export const workOrderItem: NavigationItem = {
  title: 'Work Order',
  shortTitle: 'WO',
  description: 'Buat, ubah, dan cetak kartu WO',
  icon: ClipboardList,
  to: '/work-order',
}

export const cuttingItem: NavigationItem = {
  title: 'Kartu Jahit',
  shortTitle: 'Kartu',
  description: 'Cetak dan pantau kartu jahit',
  icon: Scissors,
  to: '/kartu-jahit',
}

export const payrollItem: NavigationItem = {
  title: 'Gajian',
  shortTitle: 'Gajian',
  description: 'Rekap otomatis & daftar transfer',
  icon: Banknote,
  to: '/gajian',
}

export const cashAdvanceItem: NavigationItem = {
  title: 'Kasbon',
  shortTitle: 'Kasbon',
  description: 'Pinjaman, cicilan, dan sisa',
  icon: HandCoins,
  to: '/kasbon',
}

export const reportsItem: NavigationItem = {
  title: 'Laporan',
  shortTitle: 'Laporan',
  description: 'Rekap setoran, THP, rekap penjahit',
  icon: FileSpreadsheet,
  to: '/laporan',
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

export const calibrationItem: NavigationItem = {
  title: 'Kalibrasi Cetak',
  shortTitle: 'Kalibrasi',
  description: 'Atur geser cetak printer',
  icon: Ruler,
  to: '/cetak/kalibrasi',
}

export const navigationSections: NavigationSection[] = [
  { title: 'Utama', items: [homeItem, scanItem] },
  { title: 'Produksi', items: [workOrderItem, cuttingItem] },
  { title: 'Keuangan', items: [payrollItem, cashAdvanceItem, reportsItem] },
  { title: 'Data', items: [employeesItem, masterDataItem, calibrationItem] },
]

export const moduleItems: NavigationItem[] = [
  workOrderItem,
  cuttingItem,
  payrollItem,
  cashAdvanceItem,
  reportsItem,
  employeesItem,
  masterDataItem,
]
