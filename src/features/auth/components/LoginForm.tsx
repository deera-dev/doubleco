import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useSignIn } from '@/features/auth/api/mutations'
import {
  type LoginFormInput,
  type LoginFormValues,
  loginFormSchema,
} from '@/features/auth/api/schema'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { Button } from '@/shared/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { describeError } from '@/shared/lib/error-messages'

export function LoginForm() {
  const navigate = useNavigate()
  const signIn = useSignIn()
  const form = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = form.handleSubmit((values) =>
    signIn.mutate(values, { onSuccess: () => navigate({ to: '/' }) }),
  )

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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" className="h-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {signIn.error && (
          <p role="alert" className="text-destructive text-sm">
            {describeError(signIn.error)}
          </p>
        )}
        <Button type="submit" size="lg" className="h-12 w-full" disabled={signIn.isPending}>
          {signIn.isPending ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>
    </Form>
  )
}
