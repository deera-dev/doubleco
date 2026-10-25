import { normalizeLabel } from '@/shared/lib/labels'

export interface ProductCodeParts {
  initial: string
  number: string
  fabricCode: string
}

export function cutterInitial(cutter: string): string {
  return normalizeLabel(cutter).match(/[A-Z0-9]/)?.[0] ?? ''
}

export function composeProductCode(cutter: string, number: string, fabricCode: string): string {
  const initial = cutterInitial(cutter)
  const cleanNumber = normalizeLabel(number).replace(/\s+/g, '')
  const cleanFabric = normalizeLabel(fabricCode).replace(/\s+/g, '')
  if (!initial || !cleanNumber || !cleanFabric) return ''
  return `${initial}-${cleanNumber} ${cleanFabric}`
}

export function previewProductCode(cutter: string, number: string, fabricCode: string): string {
  const initial = cutterInitial(cutter) || '?'
  const cleanNumber = normalizeLabel(number).replace(/\s+/g, '') || '…'
  const cleanFabric = normalizeLabel(fabricCode).replace(/\s+/g, '') || '???'
  return `${initial}-${cleanNumber} ${cleanFabric}`
}

export function parseProductCode(code: string): ProductCodeParts | null {
  const match = normalizeLabel(code).match(/^([A-Z0-9])[-\s]?(\S+?)\s+(\S+)$/)
  if (!match?.[1] || !match[2] || !match[3]) return null
  return { initial: match[1], number: match[2], fabricCode: match[3] }
}
