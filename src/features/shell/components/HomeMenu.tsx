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
        <p className="text-muted-foreground text-sm">Selamat bekerja,</p>
        <h1 className="text-metal font-semibold text-2xl tracking-tight">{displayName}</h1>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {menuItems.map((item) => (
          <li key={item.title}>
            <div aria-disabled="true" className="glass flex h-full flex-col gap-3 rounded-2xl p-4">
              <span className="sheen-primary flex size-10 items-center justify-center rounded-xl">
                <item.icon className="size-5 text-primary-foreground" />
              </span>
              <div>
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.description}</p>
              </div>
              <span className="mt-auto w-fit rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
                Segera hadir
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
