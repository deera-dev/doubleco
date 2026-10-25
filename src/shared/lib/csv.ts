export interface CsvColumn<Row> {
  header: string
  value: (row: Row) => string | number | null
}

const DELIMITER = ';'

function escapeCell(value: string | number | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(DELIMITER)
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(DELIMITER),
  )
  return [header, ...body].join('\r\n')
}

export function downloadCsv<Row>(fileName: string, rows: Row[], columns: CsvColumn<Row>[]) {
  const blob = new Blob([`﻿${toCsv(rows, columns)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
