import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useActivateAccount } from '@/features/auth/api/mutations'
import {
  type ActivationFormInput,
  type ActivationFormValues,
  activationFormSchema,
} from '@/features/auth/api/schema'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { Button } from '@/shared/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'

export function ActivationForm() {
  const activate = useActivateAccount()
  const form = useForm<ActivationFormInput, unknown, ActivationFormValues>({
    resolver: zodResolver(activationFormSchema),
    defaultValues: { username: '', code: '', password: '', confirmPassword: '' },
  })

  if (activate.isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CircleCheck className="size-12 text-success" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Akun berhasil diaktifkan</p>
          <p className="text-muted-foreground text-sm">
            Silakan masuk dengan username dan password baru Anda.
          </p>
        </div>
        <Button asChild size="lg" className="h-12 w-full">
          <Link to="/login">Masuk sekarang</Link>
        </Button>
      </div>
    )
  }

  const onSubmit = form.handleSubmit((values) => activate.mutate(values))

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-12"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kode aktivasi</FormLabel>
              <FormControl>
                <Input
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={8}
                  className="h-12 font-mono uppercase tracking-widest"
                  {...field}
                />
              </FormControl>
              <FormDescription>8 karakter dari Kepala Produksi / admin.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password baru</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" className="h-12" {...field} />
              </FormControl>
              <FormDescription>Minimal 8 karakter.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ulangi password baru</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" className="h-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {activate.error && (
          <p role="alert" className="text-destructive text-sm">
            {describeError(activate.error)}
          </p>
        )}
        <Button type="submit" size="lg" className="h-12 w-full" disabled={activate.isPending}>
          {activate.isPending ? 'Memproses…' : 'Aktifkan akun'}
        </Button>
      </form>
    </Form>
  )
}
