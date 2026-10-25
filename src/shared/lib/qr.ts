import QRCode from 'qrcode'

interface QrOptions {
  /** Raw SVG markup drawn in the centre on a white plate. Uses high error correction so it still scans. */
  logoSvg?: string
}

const LOGO_SHARE = 0.2
const PLATE_SHARE = 0.26

function withLogo(qrSvg: string, logoSvg: string) {
  const size = Number(/viewBox="0 0 (\d+)/.exec(qrSvg)?.[1])
  if (!size) return qrSvg
  const plate = size * PLATE_SHARE
  const logo = size * LOGO_SHARE
  const logoMarkup = logoSvg
    .replace(/<title>.*?<\/title>/s, '')
    .replace(/<svg\b[^>]*?(viewBox="[^"]*")[^>]*>/, (_match, viewBox: string) => {
      const at = (size - logo) / 2
      return `<svg x="${at}" y="${at}" width="${logo}" height="${logo}" ${viewBox} preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision">`
    })
  const plateAt = (size - plate) / 2
  const overlay = `<rect x="${plateAt}" y="${plateAt}" width="${plate}" height="${plate}" fill="#ffffff"/>${logoMarkup}`
  return qrSvg.replace(/<\/svg>\s*$/, `${overlay}</svg>`)
}

export async function qrDataUri(payload: string, options: QrOptions = {}): Promise<string> {
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: options.logoSvg ? 'H' : 'M',
  })
  const finalSvg = options.logoSvg ? withLogo(svg, options.logoSvg) : svg
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(finalSvg)}`
}
