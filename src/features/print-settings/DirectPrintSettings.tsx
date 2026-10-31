import { Plug, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Switch } from '@/shared/components/ui/switch'
import { listPrinters, type PrinterGroup, useDirectPrintSettings } from '@/shared/lib/direct-print'
import { cn } from '@/shared/lib/utils'

const groups: { group: PrinterGroup; label: string; paper: string }[] = [
  { group: 'sewing_card', label: 'Kartu jahit', paper: 'kertas 6×10 cm' },
  { group: 'work_order_card', label: 'Kartu WO', paper: 'kertas 12×16 cm' },
  { group: 'report', label: 'Laporan (THP, rekap)', paper: 'kertas A4' },
]

type Connection =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; printers: string[] }
  | { kind: 'failed' }

/**
 * Direct printing through QZ Tray on this PC: each paper goes to its own printer at the right
 * size, so nobody has to change the PC's default printer settings between kartu and A4.
 */
export function DirectPrintSettings() {
  const [settings, save] = useDirectPrintSettings()
  const [connection, setConnection] = useState<Connection>({ kind: 'idle' })
  const printers = connection.kind === 'ok' ? connection.printers : []

  const connect = async () => {
    setConnection({ kind: 'checking' })
    try {
      setConnection({ kind: 'ok', printers: await listPrinters() })
    } catch (error) {
      console.error(error)
      setConnection({ kind: 'failed' })
    }
  }

  return (
    <section className="surface space-y-4 rounded-3xl p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-semibold">Cetak langsung (QZ Tray)</h2>
        <p className="text-muted-foreground text-sm">
          Tombol Cetak langsung mengirim ke printer yang dipilih, dengan ukuran kertas yang benar
          dan tanpa dialog. Perlu QZ Tray terpasang dan berjalan di PC ini.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={connect}
          disabled={connection.kind === 'checking'}
        >
          {connection.kind === 'ok' ? <RefreshCw /> : <Plug />}
          {connection.kind === 'checking'
            ? 'Menghubungkan…'
            : connection.kind === 'ok'
              ? 'Muat ulang printer'
              : 'Hubungkan ke QZ Tray'}
        </Button>
        <span
          className={cn(
            'text-sm',
            connection.kind === 'ok' && 'text-success',
            connection.kind === 'failed' && 'text-destructive',
            connection.kind !== 'ok' && connection.kind !== 'failed' && 'text-muted-foreground',
          )}
        >
          {connection.kind === 'ok'
            ? `Terhubung · ${printers.length} printer`
            : connection.kind === 'failed'
              ? 'QZ Tray tidak terhubung. Pastikan sudah terpasang dan berjalan, lalu coba lagi.'
              : 'Belum dicek'}
        </span>
      </div>

      <Switch
        checked={settings.enabled}
        onCheckedChange={(enabled) => save({ ...settings, enabled })}
        label="Pakai cetak langsung di PC ini"
        description="Kalau QZ Tray mati, tombol Cetak otomatis kembali ke dialog cetak biasa."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {groups.map(({ group, label, paper }) => {
          const chosen = settings.printers[group] ?? ''
          // Keep a saved printer visible even before QZ Tray answers.
          const options = chosen && !printers.includes(chosen) ? [chosen, ...printers] : printers
          return (
            <div key={group} className="space-y-1.5">
              <Label htmlFor={`printer-${group}`}>{label}</Label>
              <NativeSelect
                id={`printer-${group}`}
                value={chosen}
                disabled={options.length === 0}
                onChange={(event) =>
                  save({
                    ...settings,
                    printers: { ...settings.printers, [group]: event.target.value || undefined },
                  })
                }
              >
                <option value="">
                  {options.length === 0 ? 'Hubungkan dulu' : 'Pakai dialog cetak'}
                </option>
                {options.map((printer) => (
                  <option key={printer} value={printer}>
                    {printer}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-muted-foreground text-xs">{paper}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
