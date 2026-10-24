import { z } from 'zod'

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username 3–20 karakter: huruf kecil, angka, atau _')

export const loginFormSchema = z.object({
  username: usernameField,
  password: z.string().min(1, 'Password wajib diisi'),
})

export const activationFormSchema = z
  .object({
    username: usernameField,
    code: z.string().trim().toUpperCase().length(8, 'Kode aktivasi terdiri dari 8 karakter'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .max(72, 'Password maksimal 72 karakter'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Konfirmasi password tidak sama',
    path: ['confirmPassword'],
  })

export const activationResponseSchema = z.object({
  activated: z.literal(true),
})

export const appRoleSchema = z.enum([
  'production_head',
  'finishing_head',
  'warehouse',
  'owner',
  'cutter',
  'tailor',
])

export const meSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  role: appRoleSchema.nullable(),
  hasAccess: z.boolean(),
})

export type LoginFormInput = z.input<typeof loginFormSchema>
export type LoginFormValues = z.output<typeof loginFormSchema>
export type ActivationFormInput = z.input<typeof activationFormSchema>
export type ActivationFormValues = z.output<typeof activationFormSchema>
export type AppRole = z.infer<typeof appRoleSchema>
export type Me = z.infer<typeof meSchema>
