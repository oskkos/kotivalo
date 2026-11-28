import { jsPDF } from 'jspdf'
import { afterEach, describe, expect, test } from 'vitest'
import { overwriteGetLocale } from '#/paraglide/runtime.js'
import { renderYearSummaryPdf } from './pdf-render'
import type { Check, Part } from './summary'
import type { FlatCard, PdfFlat, YearSummaryPdfView } from './view'

afterEach(() => {
  overwriteGetLocale(() => 'fi')
})

const now = new Date(Date.UTC(2026, 10, 27, 10, 0, 0))

const row = (parts: Part[]) => ({
  parts,
  cents: parts.reduce((sum, part) => sum + part.cents, 0),
})

const card = (propertyId: string, streetAddress: string): FlatCard => ({
  propertyId,
  streetAddress,
  housingCompanyName: 'As Oy Kuusikuja 3',
  businessId: '0112038-9',
  share: 10000,
  income: 100000,
  costs: 50000,
  checks: [],
  owners: [],
})

const flat = (
  propertyId: string,
  streetAddress: string,
  checks: Check[] = [],
): PdfFlat => ({
  propertyId,
  streetAddress,
  postcode: '33100',
  city: 'Tampere',
  owners: [],
  rows: {
    '2.1': row([{ key: 'rent_payments', cents: 100000 }]),
    '2.2': row([{ key: 'maintenance_charge', cents: 50000 }]),
    '2.3': row([]),
    '2.4': row([]),
    '2.5': row([]),
  },
  outside: { capitalised: 0, improvements: 0, depositDamage: 0 },
  details: {
    name: 'As Oy Kuusikuja 3',
    businessId: '0112038-9',
    apartmentNumber: 'B 12',
    tenant: { kind: 'none' },
    period: null,
    tenancies: [],
    share: 10000,
  },
  checks,
})

const manyChecks: Check[] = Array.from({ length: 40 }, (_, i) => ({
  kind: 'vacant' as const,
  months: [`2025-${String((i % 12) + 1).padStart(2, '0')}`],
}))

const view = (overflow: boolean): YearSummaryPdfView => ({
  holder: { kind: 'own' },
  holderName: 'Annika Kotivalo',
  today: '2026-11-27',
  year: 2025,
  cards: [card('a', 'Kuusikuja 3 B 12'), card('b', 'Rantatie 15 C 21')],
  notIncluded: [],
  flats: [
    flat('a', 'Kuusikuja 3 B 12', overflow ? manyChecks : []),
    flat('b', 'Rantatie 15 C 21'),
  ],
})

/** The PDF as text: with no compression its strings can be read. */
async function readable(blob: Blob): Promise<string> {
  return new TextDecoder('windows-1252').decode(await blob.arrayBuffer())
}

const pageCount = (text: string) =>
  (text.match(/\/Type \/Page\n/g) ?? []).length

const noLogo = () => Promise.resolve(null)

describe('The standard font', () => {
  test('Helvetica keeps € – · and the Nordic letters', () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false })
    doc.setFont('helvetica', 'normal')
    const text = '€ – · ä ö å Ä Ö Å'
    doc.text(text, 40, 40)
    const bytes = doc.output('arraybuffer')
    const written = new TextDecoder('windows-1252').decode(bytes)
    expect(written).toContain(`(${text}) Tj`)
  })
})

describe('Rendering the PDF', () => {
  test('The output is a PDF', async () => {
    const blob = await renderYearSummaryPdf(view(false), now, {
      loadLogo: noLogo,
    })
    expect(blob.type).toBe('application/pdf')
    const head = new TextDecoder().decode(
      (await blob.arrayBuffer()).slice(0, 4),
    )
    expect(head).toBe('%PDF')
  })

  test('A flat with many checks continues on a second page', async () => {
    const options = { loadLogo: noLogo, compress: false }
    const short = await readable(
      await renderYearSummaryPdf(view(false), now, options),
    )
    const long = await readable(
      await renderYearSummaryPdf(view(true), now, options),
    )
    expect(pageCount(short)).toBe(3)
    expect(pageCount(long)).toBeGreaterThan(3)
    // The cover's page numbers: the second flat moves down with the first.
    expect(short).toContain('(3) Tj')
    expect(long).not.toContain('(3) Tj')
    expect(long).toContain(`(${String(pageCount(long))}) Tj`)
    // The address is repeated on the continuing sheet.
    expect(long.split('(Kuusikuja 3 B 12) Tj').length).toBeGreaterThan(3)
  })

  test('The PDF is made without the logo when it can not be loaded', async () => {
    const blob = await renderYearSummaryPdf(view(false), now, {
      loadLogo: () => Promise.reject(new Error('offline')),
    })
    expect(blob.size).toBeGreaterThan(1000)
  })

  test('A cell is wrapped in the font it is drawn in', async () => {
    // The cover's flat column, 40 % of the page's text width, less padding.
    const width = 0.4 * (595.28 - 80) - 8
    const address = 'Pohjoinen Rautatiekatu 21 A 12, 00100 Helsinki'
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    // It fits in the small regular font but not in the bold one it is drawn in.
    expect(doc.getTextWidth(address)).toBeLessThan(width)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    expect(doc.getTextWidth(address)).toBeGreaterThan(width)
    const [first] = doc.splitTextToSize(address, width) as string[]

    const long = view(false)
    long.flats[0] = { ...long.flats[0], streetAddress: address }
    const text = await readable(
      await renderYearSummaryPdf(long, now, {
        loadLogo: noLogo,
        compress: false,
      }),
    )
    expect(text).toContain(`(${first}) Tj`)
  })

  test('Text outside the font is replaced', async () => {
    const odd = view(false)
    odd.flats[0] = {
      ...odd.flats[0],
      streetAddress: 'Łukasz → Wiśniewski',
    }
    const text = await readable(
      await renderYearSummaryPdf(odd, now, {
        loadLogo: noLogo,
        compress: false,
      }),
    )
    expect(text).toContain('(Lukasz – Wisniewski) Tj')
  })

  test('A row name with its Finnish original is wrapped, not cut off', async () => {
    overwriteGetLocale(() => 'en')
    const text = await readable(
      await renderYearSummaryPdf(view(false), now, {
        loadLogo: noLogo,
        compress: false,
      }),
    )
    expect(text).toContain('(Gross rental income \\(bruttovuokratulot\\)) Tj')
    // Row 2.3's name is longer than the column and goes on a second line.
    expect(text).toContain(
      'company \\(yhtiön tulouttamat pääomavastikkeet\\)) Tj',
    )
  })
})
