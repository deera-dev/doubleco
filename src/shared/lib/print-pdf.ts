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
  /** Pure black and white, no grey or anti-aliasing: crisp on a dot-matrix printer. */
  monochrome?: boolean
  /**
   * Lay a landscape sheet on a portrait page, turned a quarter (top of the sheet at the left
   * edge), the way the paper actually goes through the printer. Direct printing sends this, so
   * neither QZ Tray nor the driver has to rotate anything, which is where landscape prints came
   * out shifted and cut.
   */
  portraitPaper?: boolean
}

const CSS_PX_PER_MM = 96 / 25.4
const TARGET_DPI = 300
/** Epson LQ-310 prints 180 dpi down the page: black-and-white sheets are drawn at exactly that. */
const DOT_MATRIX_DPI = 180

/**
 * Turns every pixel black or white. A dot-matrix driver dithers grey (anti-aliased text edges,
 * light lines) into scattered pins, which reads as blur; hard black edges print sharp.
 */
async function toBlackAndWhite(dataUrl: string): Promise<string> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) return dataUrl
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  for (let index = 0; index < data.length; index += 4) {
    const luminance =
      0.299 * (data[index] ?? 255) +
      0.587 * (data[index + 1] ?? 255) +
      0.114 * (data[index + 2] ?? 255)
    const value = luminance < 190 ? 0 : 255
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL('image/png')
}

async function renderSheet(sheet: HTMLElement, dpi: number): Promise<string> {
  const { toPng } = await import('html-to-image')
  // Text measured before the web font arrived would be cut short ("MI…") in the image.
  await document.fonts.ready
  const options = {
    pixelRatio: dpi / 96,
    backgroundColor: '#ffffff',
    // The on-screen calibration shift is applied in the PDF instead, so it is not doubled.
    style: { transform: 'none', margin: '0' },
    cacheBust: true,
  }
  // Safari sometimes paints images only on the second pass through the SVG renderer.
  await toPng(sheet, options).catch(() => undefined)
  return toPng(sheet, options)
}

/**
 * Draws the sheet on the whole landscape page (calibration shift included) and turns the page a
 * quarter counter-clockwise, so the top of the sheet ends up along the left edge of the paper.
 */
async function turnedPage(
  dataUrl: string,
  page: { widthMm: number; heightMm: number },
  placed: { left: number; top: number; width: number; height: number },
  dpi: number,
): Promise<string> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const pxPerMm = dpi / 25.4
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(page.heightMm * pxPerMm)
  canvas.height = Math.round(page.widthMm * pxPerMm)
  const context = canvas.getContext('2d')
  if (!context) return dataUrl
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(0, canvas.height)
  context.rotate(-Math.PI / 2)
  context.drawImage(
    image,
    placed.left * pxPerMm,
    placed.top * pxPerMm,
    placed.width * pxPerMm,
    placed.height * pxPerMm,
  )
  return canvas.toDataURL('image/png')
}

export async function buildPdf({
  sheets,
  widthMm,
  heightMm,
  offsets,
  fileName,
  monochrome = false,
  portraitPaper = false,
}: PdfOptions) {
  const { jsPDF } = await import('jspdf')
  const turn = portraitPaper && widthMm > heightMm
  const pageWidth = turn ? heightMm : widthMm
  const pageHeight = turn ? widthMm : heightMm
  const orientation = pageWidth > pageHeight ? 'landscape' : 'portrait'
  const dpi = monochrome ? DOT_MATRIX_DPI : TARGET_DPI
  const pdf = new jsPDF({
    unit: 'mm',
    format: [pageWidth, pageHeight],
    orientation,
    compress: true,
  })
  for (const [index, sheet] of sheets.entries()) {
    if (index > 0) pdf.addPage([pageWidth, pageHeight], orientation)
    const rendered = await renderSheet(sheet, dpi)
    const placed = {
      left: offsets.left,
      top: offsets.top,
      width: sheet.offsetWidth / CSS_PX_PER_MM,
      height: sheet.offsetHeight / CSS_PX_PER_MM,
    }
    // Black and white last, so turning the page cannot bring grey edges back.
    const finish = (dataUrl: string) => (monochrome ? toBlackAndWhite(dataUrl) : dataUrl)
    if (turn) {
      const page = await finish(await turnedPage(rendered, { widthMm, heightMm }, placed, dpi))
      pdf.addImage(page, 'PNG', 0, 0, pageWidth, pageHeight)
    } else {
      const image = await finish(rendered)
      pdf.addImage(image, 'PNG', placed.left, placed.top, placed.width, placed.height)
    }
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
  downloadFile(file)
}

/** Saves the file straight to Downloads, never through the share sheet. */
export function downloadFile(file: File) {
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
