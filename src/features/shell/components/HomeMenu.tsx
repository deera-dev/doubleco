import {
  Banknote,
  ClipboardList,
  HandCoins,
  type LucideIcon,
  Package,
  ScanLine,
  Scissors,
  Users,
} from 'lucide-react'

interface MenuItem {
  title: string
  description: string
  icon: LucideIcon
}

const menuItems: MenuItem[] = [
  { title: 'Scan Kartu', description: 'Setor & periksa', icon: ScanLine },
  { title: 'Work Order', description: 'Buat & cetak WO', icon: ClipboardList },
  { title: 'Potong & Bagi', description: 'Kartu jahit', icon: Scissors },
  { title: 'Gajian', description: 'Rekap Sabtu', icon: Banknote },
  { title: 'Kasbon', description: 'Pinjaman & cicilan', icon: HandCoins },
  { title: 'Karyawan', description: 'Aktif & tidak aktif', icon: Users },
  { title: 'Master Data', description: 'Produk, bahan, tarif', icon: Package },
]

export function HomeMenu({ displayName }: { displayName: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-semibold text-foreground text-xl">Halo, {displayName}</h1>
        <p className="text-muted-foreground text-sm">Pilih menu untuk mulai bekerja.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {menuItems.map((item) => (
          <li key={item.title}>
            <div
              aria-disabled="true"
              className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 opacity-70"
            >
              <item.icon className="size-6 text-primary" />
              <div>
                <p className="font-medium text-foreground text-sm">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.description}</p>
              </div>
              <span className="mt-auto text-muted-foreground text-xs">Segera hadir</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
