export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-label="Memuat data">
      {Array.from({ length: rows }, (_, index) => `skeleton-${index}`).map((key) => (
        <div key={key} className="surface h-18 animate-pulse rounded-2xl" />
      ))}
    </div>
  )
}
