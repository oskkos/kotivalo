// Draws the year summary PDF's document model on A4 with jsPDF (openspec:
// year-summary, design decisions 1, 4 and 6). This is the only file that
// imports the PDF library, and the browser loads it only when the PDF is
// asked for. Every string goes through pdfText first, because the standard
// font has no arrow and no letters beyond Windows-1252.
import { jsPDF } from 'jspdf'
import { colors } from '#/theme/tokens'
import {
  pdfDocument,
  type PdfBlock,
  type PdfColumn,
  type PdfDocument,
  type PdfPage,
} from './pdf-document'
import { pdfText } from './pdf-text'
import type { YearSummaryPdfView } from './view'

const MARGIN = 40
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const WIDTH = PAGE_WIDTH - 2 * MARGIN
const BOTTOM = PAGE_HEIGHT - 48
const LOGO_PATH = '/email/logo.png'
const LOGO_RATIO = 246 / 64

type Rgb = [number, number, number]

const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

const TEXT = rgb(colors.plum)
const MUTED = rgb(colors.plumMuted)
const LINE = rgb(colors.cardBorder)
const BAND = rgb(colors.lavenderTint)

export interface RenderOptions {
  /** The logo's PNG bytes; the default fetches it. Null goes without. */
  loadLogo?: () => Promise<Uint8Array | null>
  /** Compress the streams; tests turn it off to read the text. */
  compress?: boolean
}

async function fetchLogo(): Promise<Uint8Array | null> {
  try {
    const response = await fetch(LOGO_PATH)
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : null
  } catch {
    return null
  }
}

/** One pass of drawing: pages and where each logical page starts. */
class Painter {
  readonly pdf: jsPDF
  /** The physical page each logical page starts on. */
  readonly firstPages: Record<string, number> = {}
  private y = MARGIN

  constructor(
    private readonly document: PdfDocument,
    private readonly logo: Uint8Array | null,
    compress: boolean,
  ) {
    this.pdf = new jsPDF({ unit: 'pt', format: 'a4', compress })
    this.pdf.setLineWidth(0.5)
  }

  paint(): void {
    this.document.pages.forEach((page, i) => {
      if (i > 0) {
        this.pdf.addPage()
      }
      this.firstPages[page.id] = this.pdf.getNumberOfPages()
      this.startPage(page, i === 0)
      for (const block of page.blocks) {
        this.block(block, page)
      }
    })
    const pages = this.pdf.getNumberOfPages()
    for (let n = 1; n <= pages; n += 1) {
      this.pdf.setPage(n)
      this.style(8, 'normal', MUTED)
      this.pdf.text(
        pdfText(this.document.footer(n, pages)),
        MARGIN,
        PAGE_HEIGHT - 28,
      )
    }
  }

  private style(size: number, weight: 'normal' | 'bold', color: Rgb) {
    this.pdf.setFont('helvetica', weight)
    this.pdf.setFontSize(size)
    this.pdf.setTextColor(...color)
  }

  private lines(text: string, width: number): string[] {
    return this.pdf.splitTextToSize(pdfText(text), width) as string[]
  }

  /** Starts a new sheet when `height` doesn't fit; true if it did. */
  private ensure(height: number, page: PdfPage): boolean {
    if (this.y + height <= BOTTOM) {
      return false
    }
    this.pdf.addPage()
    this.startPage(page, false)
    return true
  }

  private startPage(page: PdfPage, cover: boolean) {
    this.y = MARGIN
    const logoHeight = cover ? 32 : 24
    if (this.logo) {
      this.pdf.addImage(
        this.logo,
        'PNG',
        MARGIN,
        this.y,
        logoHeight * LOGO_RATIO,
        logoHeight,
      )
    }
    this.y += logoHeight + 14
    if (page.aside) {
      this.style(9, 'normal', MUTED)
      this.pdf.text(pdfText(page.aside), PAGE_WIDTH - MARGIN, MARGIN + 10, {
        align: 'right',
      })
    }
    this.style(9, 'bold', MUTED)
    this.pdf.text(pdfText(page.kicker), MARGIN, this.y)
    this.y += 20
    this.style(cover ? 22 : 18, 'bold', TEXT)
    this.pdf.text(this.lines(page.title, WIDTH), MARGIN, this.y)
    this.y += cover ? 22 : 18
    if (this.document.band) {
      this.band(this.document.band)
    }
  }

  private band(band: { title: string; text: string }) {
    const text = this.lines(band.text, WIDTH - 20)
    const height = 12 + 13 + text.length * 11.5
    this.pdf.setFillColor(...BAND)
    this.pdf.roundedRect(MARGIN, this.y, WIDTH, height, 6, 6, 'F')
    this.style(9.5, 'bold', TEXT)
    this.pdf.text(pdfText(band.title), MARGIN + 10, this.y + 15)
    this.style(9, 'normal', TEXT)
    this.pdf.text(text, MARGIN + 10, this.y + 28)
    this.y += height + 10
  }

  private block(block: PdfBlock, page: PdfPage) {
    this.y += 12
    switch (block.kind) {
      case 'paragraph':
        this.paragraph(block.text, block.muted === true, page)
        break
      case 'pairs':
        this.pairs(block, page)
        break
      case 'notes':
        this.notes(block, page)
        break
      case 'table':
        this.table(block, page)
        break
    }
  }

  private heading(text: string, tag: string | undefined, page: PdfPage) {
    this.ensure(40, page)
    this.style(11, 'bold', TEXT)
    this.pdf.text(pdfText(text), MARGIN, this.y)
    if (tag) {
      this.style(9, 'bold', TEXT)
      this.pdf.text(pdfText(tag), PAGE_WIDTH - MARGIN, this.y, {
        align: 'right',
      })
    }
    this.y += 8
  }

  private paragraph(text: string, muted: boolean, page: PdfPage) {
    this.style(9, 'normal', muted ? MUTED : TEXT)
    for (const line of this.lines(text, WIDTH)) {
      this.ensure(12, page)
      this.style(9, 'normal', muted ? MUTED : TEXT)
      this.y += 11.5
      this.pdf.text(line, MARGIN, this.y)
    }
  }

  private pairs(block: Extract<PdfBlock, { kind: 'pairs' }>, page: PdfPage) {
    if (block.title) {
      this.heading(block.title, undefined, page)
    }
    for (const row of block.rows) {
      const value = this.lines(row.value, WIDTH * 0.62)
      const height = Math.max(value.length * 12, 12) + 8
      this.ensure(height, page)
      this.pdf.setDrawColor(...LINE)
      this.pdf.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y)
      this.style(8.5, 'bold', MUTED)
      this.pdf.text(pdfText(row.label), MARGIN, this.y + 13)
      this.style(10, 'bold', TEXT)
      this.pdf.text(value, MARGIN + WIDTH * 0.38, this.y + 13)
      this.y += height
    }
  }

  private notes(block: Extract<PdfBlock, { kind: 'notes' }>, page: PdfPage) {
    this.heading(block.title, undefined, page)
    for (const item of block.items) {
      const title = this.lines(item.title, WIDTH)
      const text = this.lines(item.text, WIDTH)
      this.ensure(title.length * 12 + text.length * 11 + 10, page)
      this.y += 10
      this.style(10, 'bold', TEXT)
      this.pdf.text(title, MARGIN, this.y)
      this.y += (title.length - 1) * 12 + 11
      this.style(9, 'normal', MUTED)
      this.pdf.text(text, MARGIN, this.y)
      this.y += (text.length - 1) * 11
    }
    this.y += 8
  }

  private table(block: Extract<PdfBlock, { kind: 'table' }>, page: PdfPage) {
    if (block.title) {
      this.heading(block.title, block.tag, page)
    }
    const xs = columnStarts(block.columns)
    const header = () => {
      if (!block.header) {
        return
      }
      this.style(8, 'bold', MUTED)
      const cells = block.header.map((text, c) =>
        this.cell(text, block.columns[c], false),
      )
      this.y += 10
      block.columns.forEach((column, c) => {
        this.drawCell(cells[c] ?? [], column, xs[c] ?? 0, this.y, 'header')
      })
      this.y += Math.max(...cells.map((lines) => lines.length)) * 10 + 2
    }
    header()
    for (const row of block.rows) {
      const cells = row.map((text, c) =>
        this.cell(text, block.columns[c], block.columns[c]?.stacked === true),
      )
      const height = Math.max(...cells.map((lines) => lines.length)) * 12 + 10
      if (this.ensure(height + 4, page)) {
        header()
      }
      this.pdf.setDrawColor(...LINE)
      this.pdf.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y)
      block.columns.forEach((column, c) => {
        this.drawCell(
          cells[c] ?? [],
          column,
          xs[c] ?? 0,
          this.y + 14,
          column.stacked === true ? 'stacked' : 'plain',
        )
      })
      this.y += height
    }
  }

  /** A cell's wrapped lines, the stacked ones' first line marked. */
  private cell(
    text: string,
    column: PdfColumn | undefined,
    stacked: boolean,
  ): string[] {
    const width = (column?.width ?? 0.2) * WIDTH - 8
    this.style(stacked ? 8.5 : 10, 'normal', TEXT)
    return text.split('\n').flatMap((part) => this.lines(part, width))
  }

  private drawCell(
    lines: string[],
    column: PdfColumn,
    x: number,
    y: number,
    kind: 'header' | 'stacked' | 'plain',
  ) {
    const at = column.align === 'right' ? x + column.width * WIDTH - 8 : x
    lines.forEach((line, i) => {
      if (kind === 'header') {
        this.style(8, 'bold', MUTED)
      } else if (kind === 'stacked' && i > 0) {
        this.style(8.5, 'normal', MUTED)
      } else {
        this.style(10, 'bold', TEXT)
      }
      this.pdf.text(line, at, y + i * 12, { align: column.align })
    })
  }
}

function columnStarts(columns: PdfColumn[]): number[] {
  let x = MARGIN
  return columns.map((column) => {
    const start = x
    x += column.width * WIDTH
    return start
  })
}

/**
 * The year summary as a PDF. It lays the document out once to learn where each
 * flat's pages start, so the cover's page numbers follow a flat that runs over
 * a sheet, then draws it again with them.
 */
export async function renderYearSummaryPdf(
  view: YearSummaryPdfView,
  now: Date,
  options: RenderOptions = {},
): Promise<Blob> {
  const logo = await (options.loadLogo ?? fetchLogo)().catch(() => null)
  const compress = options.compress ?? true
  const measure = new Painter(pdfDocument(view, now), logo, compress)
  measure.paint()
  const painter = new Painter(
    pdfDocument(view, now, measure.firstPages),
    logo,
    compress,
  )
  painter.paint()
  return new Blob([painter.pdf.output('arraybuffer')], {
    type: 'application/pdf',
  })
}
