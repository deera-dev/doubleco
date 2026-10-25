import QRCode from 'qrcode'

export async function qrDataUri(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
