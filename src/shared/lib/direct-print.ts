/**
 * Direct printing on the office PC through QZ Tray: the chosen printer, the real paper size,
 * fitted to the printable area, no dialog. QZ Tray only runs requests signed with our certificate; the server
 * signs them (master-data/qz_sign), so the private key never reaches the browser.
 *
 * Printer names belong to that one PC, so the choices are kept on the device.
 */
import { useState } from 'react'
import { z } from 'zod'
import { callAction } from '@/shared/lib/bff-action'

export type PrinterGroup = 'sewing_card' | 'work_order_card' | 'thp' | 'report'

export interface DirectPrintSettings {
  enabled: boolean
  printers: Partial<Record<PrinterGroup, string>>
}

const settingsKey = 'doubleco.direct-print'
const emptySettings: DirectPrintSettings = { enabled: false, printers: {} }

export function readDirectPrintSettings(): DirectPrintSettings {
  try {
    const saved = JSON.parse(
      localStorage.getItem(settingsKey) ?? 'null',
    ) as DirectPrintSettings | null
    return saved && typeof saved.enabled === 'boolean' ? saved : emptySettings
  } catch {
    return emptySettings
  }
}

export function useDirectPrintSettings(): [
  DirectPrintSettings,
  (next: DirectPrintSettings) => void,
] {
  const [settings, setSettings] = useState(readDirectPrintSettings)
  const save = (next: DirectPrintSettings) => {
    setSettings(next)
    try {
      localStorage.setItem(settingsKey, JSON.stringify(next))
    } catch {
      // Not remembered on this device; it still applies until the page closes.
    }
  }
  return [settings, save]
}

/** The printer this group goes to, when direct printing is on and one was chosen. */
export function directPrinterFor(group: PrinterGroup): string | null {
  const settings = readDirectPrintSettings()
  return settings.enabled ? (settings.printers[group] ?? null) : null
}

type Qz = typeof import('qz-tray')

let qzReady: Promise<Qz> | null = null

function loadQz(): Promise<Qz> {
  qzReady ??= import('qz-tray').then((module) => {
    const qz = (module as { default?: Qz }).default ?? module
    qz.api.setPromiseType((resolver) => new Promise(resolver))
    qz.security.setCertificatePromise((resolve, reject) => {
      callAction('master-data', 'qz_certificate', z.object({ certificate: z.string().nullable() }))
        .then(({ certificate }) => resolve(certificate ?? ''))
        .catch(reject)
    })
    qz.security.setSignatureAlgorithm('SHA512')
    qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
      callAction('master-data', 'qz_sign', z.object({ signature: z.string() }), { data: toSign })
        .then(({ signature }) => resolve(signature))
        .catch(reject)
    })
    return qz
  })
  return qzReady
}

async function connectedQz(): Promise<Qz> {
  const qz = await loadQz()
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 0, delay: 0 })
  return qz
}

/** Printers installed on this PC; throws when QZ Tray is not running. */
export async function listPrinters(): Promise<string[]> {
  const qz = await connectedQz()
  const found = await qz.printers.find()
  return Array.isArray(found) ? found : [found]
}

export async function isQzRunning(): Promise<boolean> {
  try {
    await connectedQz()
    return true
  } catch {
    return false
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Sends the PDF straight to the printer, no dialog. The sheet is fitted to the area the printer
 * can actually reach: every printer has a strip at the edges it cannot print on, and at 100% that
 * strip (or a driver paper size that differs a little) cut the edges off.
 */
export async function printDirect(
  printer: string,
  file: File,
  page: { widthMm: number; heightMm: number },
  /** Black-and-white sheet for the dot-matrix printer: keep it that way, no smoothing. */
  monochrome = false,
) {
  const qz = await connectedQz()
  const isA4 =
    Math.min(page.widthMm, page.heightMm) === 210 && Math.max(page.widthMm, page.heightMm) === 297
  // `custom` exists in QZ Tray 2.2+ but not in @types/qz-tray: 6×10 and 12×16 cards are not
  // standard driver sizes.
  const size = {
    width: Math.min(page.widthMm, page.heightMm),
    height: Math.max(page.widthMm, page.heightMm),
    custom: !isA4,
  }
  const config = qz.configs.create(printer, {
    size,
    units: 'mm',
    orientation: page.widthMm > page.heightMm ? 'landscape' : 'portrait',
    margins: 0,
    scaleContent: true,
    colorType: monochrome ? 'blackwhite' : 'color',
    interpolation: monochrome ? 'nearest-neighbor' : 'bicubic',
    jobName: file.name,
  })
  await qz.print(config, [
    { type: 'pixel', format: 'pdf', flavor: 'base64', data: await toBase64(file) },
  ])
}
