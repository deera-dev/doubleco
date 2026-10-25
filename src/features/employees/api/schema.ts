import { z } from 'zod'

export const employeeStatusSchema = z.enum(['active', 'inactive', 'left'])
export const employeeTypeSchema = z.enum(['tailor', 'cutter'])

export const accountSchema = z.object({
  type: z.enum(['bank', 'ewallet']),
  provider: z.string(),
  number: z.string(),
  holder: z.string(),
})

export const employeeSchema = z.object({
  id: z.string().uuid(),
  type: employeeTypeSchema,
  code: z.string().nullable(),
  name: z.string(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  status: employeeStatusSchema,
  leftOn: z.string().nullable(),
  account: accountSchema.nullable(),
  advanceBalance: z.number(),
})

export const employeeListSchema = z.object({
  summary: z.object({
    active: z.number(),
    inactive: z.number(),
    left: z.number(),
    all: z.number(),
  }),
  employees: z.array(employeeSchema),
})

export const savedIdSchema = z.object({ id: z.string().uuid() })
export const leftResultSchema = z.object({ writtenOff: z.number() })

const optionalText = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`)

export const tailorFormSchema = z
  .object({
    code: z.string().trim().min(1, 'Kode wajib diisi').max(20, 'Maksimal 20 karakter'),
    name: z
      .string()
      .trim()
      .min(1, 'Nama wajib diisi')
      .max(60, 'Maksimal 60 karakter')
      .transform((value) => value.toUpperCase()),
    phone: optionalText(20),
    notes: optionalText(500),
    accountType: z.enum(['bank', 'ewallet']),
    accountProvider: z.string().trim().max(40),
    accountNumber: z.string().trim().max(30),
    accountHolder: z.string().trim().max(60),
  })
  .superRefine((values, context) => {
    const filled = [values.accountProvider, values.accountNumber, values.accountHolder].filter(
      (value) => value !== '',
    ).length
    if (filled > 0 && filled < 3) {
      for (const [key, value] of [
        ['accountProvider', values.accountProvider],
        ['accountNumber', values.accountNumber],
        ['accountHolder', values.accountHolder],
      ] as const) {
        if (value === '') {
          context.addIssue({ code: 'custom', path: [key], message: 'Lengkapi data rekening' })
        }
      }
    }
    if (values.accountNumber !== '' && !/^[0-9 -]+$/.test(values.accountNumber)) {
      context.addIssue({
        code: 'custom',
        path: ['accountNumber'],
        message: 'Hanya angka, spasi, atau tanda -',
      })
    }
  })

export const cutterFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama wajib diisi')
    .max(60, 'Maksimal 60 karakter')
    .transform((value) => value.toUpperCase()),
})

export type Employee = z.infer<typeof employeeSchema>
export type EmployeeList = z.infer<typeof employeeListSchema>
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>
export type TailorFormInput = z.input<typeof tailorFormSchema>
export type TailorFormValues = z.output<typeof tailorFormSchema>
export type CutterFormInput = z.input<typeof cutterFormSchema>
export type CutterFormValues = z.output<typeof cutterFormSchema>
