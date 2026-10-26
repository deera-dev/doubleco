import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = pageCount(total, pageSize)
  if (total <= pageSize) return null

  const go = (next: number) => {
    onChange(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav aria-label="Halaman" className="flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft />
        <span className="hidden sm:inline">Sebelumnya</span>
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        Halaman <span className="font-semibold text-foreground">{page}</span> dari {pages}
        <span className="hidden sm:inline"> · {total} data</span>
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
        aria-label="Halaman berikutnya"
      >
        <span className="hidden sm:inline">Berikutnya</span>
        <ChevronRight />
      </Button>
    </nav>
  )
}

/** Slices an already loaded list into pages, for lists small enough to load at once. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = Math.min(page, pageCount(items.length, pageSize))
  return items.slice((safePage - 1) * pageSize, safePage * pageSize)
}

/** Page state that falls back to page 1 whenever `key` (the search and filters) changes. */
export function usePageFor(key: string): [number, (page: number) => void] {
  const [state, setState] = useState({ key, page: 1 })
  const page = state.key === key ? state.page : 1
  return [page, (next) => setState({ key, page: next })]
}
