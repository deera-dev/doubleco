/**
 * Turns printable sheets into a PDF whose page is exactly the paper size.
 *
 * Phones print web pages with their own margins, headers (title, URL, date) and scaling, so a
 * 6×10 card never comes out right. A PDF with the real page size goes through the printer app
 * as is: choose the paper size, scale 100%.
 */

interface PdfOptions {
  sheets: HTMLElement[]
  widthMm: number
  heightMm: number
  /** Calibration shift applied on paper, in mm. */
  offsets: { top: number; left: number }
  fileName: string
}

const CSS_PX_PER_MM = 96 / 25.4
const TARGET_DPI = 300

async function renderSheet(sheet: HTMLElement): Promise<string> {
  const { toPng } = await import('html-to-image')
  const options = {
    pixelRatio: TARGET_DPI / 96,
    backgroundColor: '#ffffff',
    // The on-screen calibration shift is applied in the PDF instead, so it is not doubled.
    style: { transform: 'none', margin: '0' },
    cacheBust: true,
  }
  // Safari sometimes paints images only on the second pass through the SVG renderer.
  await toPng(sheet, options).catch(() => undefined)
  return toPng(sheet, options)
}

export async function buildPdf({ sheets, widthMm, heightMm, offsets, fileName }: PdfOptions) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    unit: 'mm',
    format: [widthMm, heightMm],
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    compress: true,
  })
  for (const [index, sheet] of sheets.entries()) {
    if (index > 0) pdf.addPage([widthMm, heightMm], widthMm > heightMm ? 'landscape' : 'portrait')
    const image = await renderSheet(sheet)
    const renderedWidthMm = sheet.offsetWidth / CSS_PX_PER_MM
    const renderedHeightMm = sheet.offsetHeight / CSS_PX_PER_MM
    pdf.addImage(image, 'PNG', offsets.left, offsets.top, renderedWidthMm, renderedHeightMm)
  }
  return new File([pdf.output('blob')], fileName, { type: 'application/pdf' })
}

/** Opens the share sheet (printer apps, Print) where the phone has one; otherwise downloads. */
export async function shareOrDownload(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

/**
 * Sends the PDF itself to the print dialog. A PDF prints at its own page size, and the browser adds
 * no title, URL or date to it the way it does when printing a web page.
 */
export function printPdf(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const frame = document.createElement('iframe')
    // Kept in the layout (not display: none) so the PDF viewer actually loads.
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
    frame.src = url
    frame.onload = () => {
      // The PDF viewer needs a moment after load before it can print.
      window.setTimeout(() => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
          resolve()
        } catch (error) {
          reject(error)
        }
      }, 400)
      window.setTimeout(() => {
        frame.remove()
        URL.revokeObjectURL(url)
      }, 120_000)
    }
    document.body.append(frame)
  })
}
