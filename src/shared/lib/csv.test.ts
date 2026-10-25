import { describe, expect, it } from 'vitest'
import { toCsv } from '@/shared/lib/csv'

describe('toCsv', () => {
  it('uses semicolons so Indonesian Excel splits columns', () => {
    const csv = toCsv(
      [{ name: 'ABENG', code: '29' }],
      [
        { header: 'Kode', value: (row) => row.code },
        { header: 'Nama', value: (row) => row.name },
      ],
    )
    expect(csv).toBe('Kode;Nama\r\n29;ABENG')
  })

  it('quotes cells containing delimiters, quotes or newlines', () => {
    const csv = toCsv([{ note: 'a;b "c"' }], [{ header: 'Catatan', value: (row) => row.note }])
    expect(csv).toBe('Catatan\r\n"a;b ""c"""')
  })

  it('leaves empty values blank', () => {
    expect(toCsv([{ phone: null }], [{ header: 'HP', value: (row) => row.phone }])).toBe('HP\r\n')
  })
})
