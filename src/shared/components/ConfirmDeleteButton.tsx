import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface ConfirmDeleteButtonProps {
  label: string
  confirmLabel?: string
  onConfirm: () => void
  isPending: boolean
  className?: string
}

export function ConfirmDeleteButton({
  label,
  confirmLabel = 'Ya, hapus permanen',
  onConfirm,
  isPending,
  className,
}: ConfirmDeleteButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <Button
      type="button"
      size="lg"
      variant={isConfirming ? 'destructive' : 'ghost'}
      className={cn(!isConfirming && 'text-destructive hover:text-destructive', className)}
      onClick={() => (isConfirming ? onConfirm() : setIsConfirming(true))}
      onBlur={() => setIsConfirming(false)}
      disabled={isPending}
    >
      <Trash2 />
      {isConfirming ? confirmLabel : label}
    </Button>
  )
}
