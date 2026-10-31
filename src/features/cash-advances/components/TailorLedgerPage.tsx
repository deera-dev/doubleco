import { Link } from '@tanstack/react-router'
import { ArrowLeft, HandCoins, LockOpen, Pencil, Plus, Printer, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useDeleteEntry } from '@/features/cash-advances/api/mutations'
import { useTailorLedger } from '@/features/cash-advances/api/queries'
import type { EntryType, LedgerEntry } from '@/features/cash-advances/api/schema'
import { EntryDialog, type EntryEditor } from '@/features/cash-advances/components/EntryDialog'
import { formatWorkOrderDate } from '@/features/work-orders/lib/status'
import { EmptyState } from '@/shared/components/EmptyState'
import { ListSkeleton } from '@/shared/components/ListSkeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { describeError } from '@/shared/lib/error-messages'
import { formatRupiah } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { toAppError } from '@/shared/types/errors'

const typeMeta: Record<EntryType, { label: string; sign: 1 | -1; className: string }> = {
  opening_balance: { label: 'Saldo awal', sign: 1, className: 'text-warning' },
  advance: { label: 'Kasbon', sign: 1, className: 'text-warning' },
  repayment: { label: 'Cicilan', sign: -1, className: 'text-success' },
  write_off: { label: 'Kerugian', sign: -1, className: 'text-muted-foreground' },
}

function describeEntry(entry: LedgerEntry): string {
  if (entry.type === 'advance' && entry.givenOn)
    return 'sudah diberikan langsung (tidak ikut transfer)'
  if (entry.type === 'repayment' && entry.payOn)
    return `dipotong dari gaji Sabtu ${formatWorkOrderDate(entry.payOn)}`
  if (entry.type === 'advance' && entry.payOn) {
    return `dibayar bersama gaji Sabtu ${formatWorkOrderDate(entry.payOn)}${entry.isPayrollLocked ? '' : ' (belum dikunci)'}`
  }
  if (entry.type === 'advance') return 'dibayar bersama gaji Sabtu berikutnya'
  if (entry.type === 'repayment') return 'dibayar tunai'
  if (entry.type === 'write_off') return 'dihapus saat penjahit keluar'
  return 'dari data lama'
}

function DeleteDialog({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  const remove = useDeleteEntry()
  const [reason, setReason] = useState('')
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Hapus {typeMeta[entry.type].label.toLowerCase()} {formatRupiah(entry.amount)}?
          </DialogTitle>
          <DialogDescription>Pakai untuk salah input. Tercatat di riwayat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-reason">Alasan</Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {remove.error && (
            <p role="alert" className="text-destructive text-sm">
              {describeError(remove.error)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={reason.trim() === '' || remove.isPending}
            onClick={() =>
              remove.mutate(
                { id: entry.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Catatan dihapus')
                    onClose()
                  },
                },
              )
            }
          >
            {remove.isPending ? 'Menghapus…' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TailorLedgerPage({ tailorId }: { tailorId: string }) {
  const ledger = useTailorLedger(tailorId)
  const [editor, setEditor] = useState<EntryEditor | null>(null)
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null)
  const tailor = ledger.data?.tailor

  return (
    <div className="space-y-6 pb-24">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/kasbon">
          <ArrowLeft />
          Kasbon
        </Link>
      </Button>
      <PageHeader
        eyebrow={tailor ? `Kode ${tailor.code}` : 'Kasbon'}
        title={tailor?.name ?? 'Memuat…'}
        description="Buku kasbon: setiap pinjaman dan cicilan, terbaru di atas."
        actions={
          tailor && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost">
                <Link to="/cetak/rekap-penjahit" search={{ penjahit: tailor.tailorId }}>
                  <Printer />
                  Rekap mingguan
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditor({ kind: 'repayment', tailor })}
              >
                <Undo2 />
                Cicilan tunai
              </Button>
              <Button type="button" onClick={() => setEditor({ kind: 'advance', tailor })}>
                <Plus />
                Kasbon baru
              </Button>
            </div>
          )
        }
      />

      {ledger.isPending ? (
        <ListSkeleton rows={3} />
      ) : ledger.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {describeError(toAppError(ledger.error))}
        </p>
      ) : (
        <>
          <section className="stagger-1 grid animate-rise grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Sisa kasbon', value: ledger.data.tailor.balance, tone: 'text-warning' },
              { label: 'Total pinjam', value: ledger.data.tailor.borrowed, tone: '' },
              { label: 'Total cicil', value: ledger.data.tailor.repaid, tone: 'text-success' },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  'surface rounded-3xl p-4 sm:p-5',
                  index === 0 && 'col-span-2 sm:col-span-1',
                )}
              >
                <p className="text-muted-foreground text-xs">{stat.label}</p>
                <p
                  className={cn(
                    'truncate font-mono font-semibold text-lg tabular-nums sm:text-2xl',
                    stat.tone,
                  )}
                >
                  {formatRupiah(stat.value)}
                </p>
              </div>
            ))}
          </section>

          {ledger.data.entries.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="Belum ada kasbon"
              description="Catat kasbon baru dengan tombol di atas."
            />
          ) : (
            <ul className="stagger-2 grid animate-rise grid-cols-1 gap-2">
              {ledger.data.entries.map((entry) => {
                const meta = typeMeta[entry.type]
                return (
                  <li
                    key={entry.id}
                    className="surface flex items-center gap-3 rounded-2xl p-4 pr-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">
                        {meta.label} · {formatWorkOrderDate(entry.entryOn)}
                      </span>
                      <span className="block truncate text-muted-foreground text-xs">
                        {describeEntry(entry)}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 font-mono font-semibold tabular-nums',
                        meta.className,
                      )}
                    >
                      {meta.sign > 0 ? '+' : '−'}
                      {formatRupiah(entry.amount)}
                    </span>
                    <span className="flex shrink-0">
                      {entry.isEditable && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Ubah"
                          onClick={() =>
                            setEditor({ kind: 'edit', tailor: ledger.data.tailor, entry })
                          }
                        >
                          <Pencil />
                        </Button>
                      )}
                      {entry.isDeletable ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Hapus"
                          onClick={() => setDeleting(entry)}
                        >
                          <Trash2 />
                        </Button>
                      ) : (
                        entry.payOn && (
                          // Locked with a payroll week: reopen that week first, then it can go.
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            title={`Buka kunci gajian Sabtu ${formatWorkOrderDate(entry.payOn)} untuk menghapus`}
                          >
                            <Link to="/gajian" search={{ sabtu: entry.payOn }}>
                              <LockOpen />
                            </Link>
                          </Button>
                        )
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {editor && ledger.data && (
        <EntryDialog
          editor={editor}
          tailors={[ledger.data.tailor]}
          today={ledger.data.today}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && <DeleteDialog entry={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
