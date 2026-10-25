import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  type NameFormInput,
  type NameFormValues,
  nameFormSchema,
} from '@/features/master-data/api/schema'
import { ConfirmDeleteButton } from '@/shared/components/ConfirmDeleteButton'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { describeError } from '@/shared/lib/error-messages'
import type { AppError } from '@/shared/types/errors'

interface NamedItemDialogProps {
  title: string
  description: string
  nameLabel: string
  placeholder: string
  initialName: string
  initialActive: boolean
  canDelete: boolean
  isSaving: boolean
  isDeleting: boolean
  saveError: AppError | null
  onSave: (values: { name: string; isActive: boolean }, onDuplicate: () => void) => void
  onDelete: () => void
  onClose: () => void
}

export function NamedItemDialog({
  title,
  description,
  nameLabel,
  placeholder,
  initialName,
  initialActive,
  canDelete,
  isSaving,
  isDeleting,
  saveError,
  onSave,
  onDelete,
  onClose,
}: NamedItemDialogProps) {
  const [isActive, setIsActive] = useState(initialActive)
  const form = useForm<NameFormInput, unknown, NameFormValues>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: { name: initialName },
  })

  const onSubmit = form.handleSubmit(({ name }) =>
    onSave({ name, isActive }, () => form.setError('name', { message: 'Nama sudah ada' })),
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{nameLabel}</FormLabel>
                  <FormControl>
                    <Input
                      autoCapitalize="characters"
                      placeholder={placeholder}
                      className="h-12 uppercase placeholder:normal-case"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Switch checked={isActive} onCheckedChange={setIsActive} label="Aktif" />
            {saveError && (
              <p role="alert" className="text-destructive text-sm">
                {describeError(saveError)}
              </p>
            )}
            <DialogFooter>
              {canDelete && (
                <ConfirmDeleteButton
                  label="Hapus"
                  className="sm:mr-auto"
                  onConfirm={onDelete}
                  isPending={isDeleting}
                />
              )}
              <Button type="button" variant="ghost" size="lg" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={isSaving}>
                {isSaving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
