import { afterEach, describe, expect, test } from 'vitest'
import { overwriteGetLocale } from '#/paraglide/runtime.js'
import { pdfDocument, type PdfBlock, type PdfDocument } from './pdf-document'
import { pdfText } from './pdf-text'
import type { Check, Part } from './summary'
import type { FlatCard, PdfFlat, YearSummaryPdfView } from './view'

afterEach(() => {
  overwriteGetLocale(() => 'fi')
})

// 27 November 2026 at noon in Finland.
const now = new Date(Date.UTC(2026, 10, 27, 10, 0, 0))

/** Money and shares as the app writes them, with plain spaces. */
const plain = (text: string) => text.replaceAll(' ', ' ')

const row = (parts: Part[]) => ({
  parts,
  cents: parts.reduce((sum, part) => sum + part.cents, 0),
})

const card = (over: Partial<FlatCard> = {}): FlatCard => ({
  propertyId: 'kuusikuja',
  streetAddress: 'Kuusikuja 3 B 12',
  housingCompanyName: 'As Oy Kuusikuja 3',
  businessId: '0112038-9',
  share: 5000,
  income: 489500,
  costs: 0,
  checks: [],
  owners: [],
  ...over,
})

const flat = (over: Partial<PdfFlat> = {}): PdfFlat => ({
  propertyId: 'kuusikuja',
  streetAddress: 'Kuusikuja 3 B 12',
  postcode: '33100',
  city: 'Tampere',
  owners: [],
  rows: {
    '2.1': row([{ key: 'rent_payments', cents: 489500 }]),
    '2.2': row([
      { key: 'maintenance_charge', cents: 117700 },
      { key: 'water', cents: 24200 },
    ]),
    '2.3': row([]),
    '2.4': row([]),
    '2.5': row([]),
  },
  outside: { capitalised: 0, improvements: 0, depositDamage: 0 },
  details: {
    name: 'As Oy Kuusikuja 3',
    businessId: '0112038-9',
    apartmentNumber: 'B 12',
    tenant: { kind: 'several' },
    period: { from: '2025-01-01', to: '2025-12-31' },
    tenancies: [
      { name: 'Aino Koski', from: '2025-01-01', to: '2025-08-31' },
      { name: 'Pekka Laine', from: '2025-10-01', to: '2025-12-31' },
    ],
    share: 5000,
  },
  checks: [],
  ...over,
})

const rantatie = {
  card: card({
    propertyId: 'rantatie',
    streetAddress: 'Rantatie 15 C 21',
    income: 381600,
  }),
  flat: flat({ propertyId: 'rantatie', streetAddress: 'Rantatie 15 C 21' }),
}

const view = (over: Partial<YearSummaryPdfView> = {}): YearSummaryPdfView => ({
  holder: { kind: 'own' },
  holderName: 'Annika Kotivalo',
  today: '2026-11-27',
  year: 2025,
  // Out of address order, to see the document sort them.
  cards: [rantatie.card, card()],
  notIncluded: [],
  flats: [rantatie.flat, flat()],
  ...over,
})

const find = <K extends PdfBlock['kind']>(
  blocks: PdfBlock[],
  kind: K,
  title?: string,
) =>
  blocks.find(
    (block): block is Extract<PdfBlock, { kind: K }> =>
      block.kind === kind &&
      (title === undefined || ('title' in block && block.title === title)),
  )

/** Every string the document has, for checking them all. */
function strings(doc: PdfDocument): string[] {
  const out: string[] = []
  if (doc.band) {
    out.push(doc.band.title, doc.band.text)
  }
  doc.pages.forEach((page, i) => {
    out.push(page.kicker, page.title, page.aside ?? '', doc.footer(i + 1, 9))
    for (const block of page.blocks) {
      switch (block.kind) {
        case 'pairs':
          out.push(block.title ?? '')
          block.rows.forEach((r) => out.push(r.label, r.value))
          break
        case 'table':
          out.push(block.title ?? '', block.tag ?? '', ...(block.header ?? []))
          block.rows.forEach((r) => out.push(...r))
          break
        case 'notes':
          out.push(block.title)
          block.items.forEach((item) => out.push(item.title, item.text))
          break
        case 'paragraph':
          out.push(block.text)
          break
      }
    }
  })
  return out
}

describe("The PDF's cover page", () => {
  test('The cover page of the own share', () => {
    const doc = pdfDocument(view(), now)
    const [first] = doc.pages
    expect(first).toMatchObject({
      id: 'cover',
      title: 'Vuosiyhteenveto 2025',
      aside: 'Tehty 27.11.2026',
    })
    const pairs = find(first.blocks, 'pairs')
    expect(pairs?.rows).toEqual([
      { label: 'Kenen luvut', value: 'Oma osuutesi · Annika Kotivalo' },
      { label: 'Ajanjakso', value: '1.1.–31.12.2025' },
    ])
    const table = find(first.blocks, 'table')
    expect(table?.rows.map((cells) => cells.map(plain))).toEqual([
      [
        'Kuusikuja 3 B 12\nAs Oy Kuusikuja 3 · Y-tunnus 0112038-9',
        '50 %',
        '4 895,00 €',
        '0,00 €',
        '2',
      ],
      [
        'Rantatie 15 C 21\nAs Oy Kuusikuja 3 · Y-tunnus 0112038-9',
        '50 %',
        '3 816,00 €',
        '0,00 €',
        '3',
      ],
    ])
    expect(doc.pages.map((page) => page.id)).toEqual([
      'cover',
      'kuusikuja',
      'rantatie',
    ])
    expect(doc.footer(1, 3)).toContain('Sivu 1/3')
  })

  test('The period ends today in the current year', () => {
    const [first] = pdfDocument(view({ year: 2026 }), now).pages
    expect(find(first.blocks, 'pairs')?.rows[1]?.value).toBe('1.1.–27.11.2026')
  })

  test("The cover's page numbers follow the measured pages", () => {
    const doc = pdfDocument(view(), now, { kuusikuja: 2, rantatie: 4 })
    const table = find(doc.pages[0].blocks, 'table')
    expect(table?.rows.map((cells) => cells[4])).toEqual(['2', '4'])
  })

  test("Another owner's cover with their name", () => {
    const doc = pdfDocument(
      view({
        holder: { kind: 'person', userId: 'mikko', name: 'Mikko Virtanen' },
        holderName: 'Mikko Virtanen',
      }),
      now,
    )
    expect(find(doc.pages[0].blocks, 'pairs')?.rows[0]?.value).toBe(
      'Mikko Virtanen',
    )
    expect(doc.pages[1].kicker).toBe('Lomake 7H · 2025 · Mikko Virtanen')
    expect(doc.footer(2, 3)).toContain('Mikko Virtanen')
    expect(doc.band).toBeNull()
  })

  test('Swedish text in the Swedish locale', () => {
    overwriteGetLocale(() => 'sv')
    const doc = pdfDocument(view(), now)
    expect(doc.pages[0].title).toBe('Årssammandrag 2025')
    expect(doc.pages[0].aside).toBe('Skapad 27.11.2026')
    expect(doc.footer(2, 3)).toBe(
      'Kotivalo · Årssammandrag 2025 · Din egen andel · Annika Kotivalo · Sida 2/3',
    )
  })

  test('A share change on the cover', () => {
    const change: Check = {
      kind: 'share_changed',
      on: '2025-07-01',
      from: 5000,
      to: 10000,
    }
    const koivupolku = card({
      propertyId: 'koivupolku',
      streetAddress: 'Koivupolku 7 A 4',
      share: 10000,
      checks: [change],
    })
    const doc = pdfDocument(
      view({
        cards: [koivupolku],
        flats: [
          flat({
            propertyId: 'koivupolku',
            streetAddress: 'Koivupolku 7 A 4',
            checks: [change],
          }),
        ],
      }),
      now,
    )
    const table = find(doc.pages[0].blocks, 'table')
    expect(plain(table?.rows[0]?.[1] ?? '')).toBe('50 % – 100 %')
    expect(table?.rows[0]?.[0]).toContain('1 tarkistettava')
    // The flat's page words the change with a dash, never the arrow.
    const notes = find(doc.pages[1].blocks, 'notes')
    expect(plain(notes?.items[0]?.title ?? '')).toBe(
      'Osuutesi muuttui 1.7.2025: 50 % – 100 %',
    )
  })

  test('A share that changed more than once', () => {
    const changes: Check[] = [
      { kind: 'share_changed', on: '2025-04-01', from: 5000, to: 10000 },
      { kind: 'share_changed', on: '2025-09-01', from: 10000, to: 5000 },
    ]
    const doc = pdfDocument(
      view({
        cards: [card({ checks: changes })],
        flats: [flat({ checks: changes })],
      }),
      now,
    )
    const table = find(doc.pages[0].blocks, 'table')
    expect(plain(table?.rows[0]?.[1] ?? '')).toBe('50 % – 100 % – 50 %')
  })

  test('Flats not included on the cover', () => {
    const doc = pdfDocument(
      view({
        notIncluded: [
          { propertyId: 'halli', streetAddress: 'Hallilantie 12 B 8' },
        ],
      }),
      now,
    )
    const paragraphs = doc.pages[0].blocks.filter(
      (block) => block.kind === 'paragraph',
    )
    expect(paragraphs.some((p) => p.text.includes('Hallilantie 12 B 8'))).toBe(
      true,
    )
    expect(doc.pages.map((page) => page.id)).not.toContain('halli')
    expect(doc.pages).toHaveLength(3)
  })
})

describe('The capital income tax estimate', () => {
  const earning = (over: Partial<YearSummaryPdfView> = {}) =>
    view({ cards: [card({ income: 871100, costs: 450300 })], ...over })

  test("The estimate on the own share's cover", () => {
    const [cover] = pdfDocument(earning(), now).pages
    const box = find(cover.blocks, 'pairs', 'Vuokratulot kulujen jälkeen')
    expect(box?.rows.map((r) => plain(r.value))).toEqual([
      '4 208,00 €',
      'n. 1 262 €',
    ])
    expect(
      cover.blocks.some(
        (block) =>
          block.kind === 'paragraph' &&
          plain(block.text).includes('Yli 30 000 €'),
      ),
    ).toBe(true)
  })

  test("No estimate on another owner's cover", () => {
    const [cover] = pdfDocument(
      earning({
        holder: { kind: 'person', userId: 'mikko', name: 'Mikko Virtanen' },
        holderName: 'Mikko Virtanen',
      }),
      now,
    ).pages
    const box = find(cover.blocks, 'pairs', 'Vuokratulot kulujen jälkeen')
    expect(box?.rows.map((r) => plain(r.value))).toEqual(['4 208,00 €'])
    expect(JSON.stringify(cover.blocks)).not.toContain('n. ')
  })

  test('A loss on the cover has no tax', () => {
    const [cover] = pdfDocument(
      view({ cards: [card({ income: 178000, costs: 302000 })] }),
      now,
    ).pages
    const box = find(cover.blocks, 'pairs', 'Vuokratulot kulujen jälkeen')
    expect(box?.rows).toHaveLength(1)
    expect(pdfText(plain(box?.rows[0]?.value ?? ''))).toBe('-1 240,00 €')
  })
})

describe("A flat's page in the PDF", () => {
  const unpaid: Check = { kind: 'unpaid', months: ['2025-12'] }
  const doc = pdfDocument(
    view({
      cards: [card({ checks: [unpaid] })],
      flats: [flat({ checks: [unpaid] })],
    }),
    now,
  )
  const page = doc.pages[1]

  test('The rows and checks of a flat', () => {
    const rows = find(page.blocks, 'table', 'Vuokratulot ja kulut')
    expect(plain(rows?.tag ?? '')).toBe('Osuus 50 %')
    const row22 = rows?.rows[1]?.map(plain)
    expect(row22?.[0]).toBe('2.2')
    expect(row22?.[2]).toBe('1 419,00 €')
    expect(row22?.[1]).toContain('Hoitovastike 1 177,00 €')
    expect(row22?.[1]).toContain('(käyttömaksu) 242,00 €')
    const notes = find(page.blocks, 'notes')
    expect(notes?.items[0]?.title).toBe(
      'Vuokraa ei ole kirjattu: Joulukuu 2025',
    )
  })

  test('Every tenancy of the year', () => {
    const tenants = find(page.blocks, 'table', 'Vuokralaiset')
    expect(tenants?.rows.map((cells) => cells.map(plain))).toEqual([
      ['Aino Koski', '1.1.–31.8.2025'],
      ['Pekka Laine', '1.10.–31.12.2025'],
    ])
    expect(page.title).toBe('Kuusikuja 3 B 12')
    expect(page.kicker).toBe('Lomake 7H · 2025 · oma osuutesi')
  })

  test('A tenancy starting after today is not listed', () => {
    // The document lists what the view has: the calculation leaves out a
    // tenancy that starts after today, so a view without it has no row.
    const upcoming = pdfDocument(
      view({
        year: 2026,
        cards: [card()],
        flats: [
          flat({
            details: {
              ...flat().details,
              tenancies: [
                { name: 'Aino Koski', from: '2026-01-01', to: '2026-11-27' },
              ],
            },
          }),
        ],
      }),
      now,
    ).pages[1]
    const tenants = find(upcoming.blocks, 'table', 'Vuokralaiset')
    expect(tenants?.rows.map((cells) => cells[0])).toEqual(['Aino Koski'])
  })

  test('The details and a year without tenancies', () => {
    const empty = pdfDocument(
      view({
        cards: [card()],
        flats: [
          flat({
            details: {
              ...flat().details,
              name: null,
              tenant: { kind: 'none' },
              period: null,
              tenancies: [],
            },
          }),
        ],
      }),
      now,
    ).pages[1]
    const details = find(empty.blocks, 'pairs')
    expect(details?.rows[0]).toEqual({
      label: 'Taloyhtiön nimi',
      value: 'Puuttuu',
    })
    expect(
      empty.blocks.some(
        (block) =>
          block.kind === 'paragraph' &&
          block.text === 'Ei vuokralaista vuonna 2025',
      ),
    ).toBe(true)
  })

  test('The case law note and what is not on form 7H', () => {
    const rich = pdfDocument(
      view({
        cards: [card()],
        flats: [
          flat({
            rows: {
              ...flat().rows,
              '2.3': row([{ key: 'financing_charge', cents: 50000 }]),
            },
            outside: {
              capitalised: 10000,
              improvements: 20000,
              depositDamage: 30000,
            },
          }),
        ],
      }),
      now,
    ).pages[1]
    const rows = find(rich.blocks, 'table', 'Vuokratulot ja kulut')
    expect(rows?.rows[2]?.[1].split('\n')).toHaveLength(3)
    const outside = find(rich.blocks, 'table', 'Ei lomakkeelle 7H')
    expect(outside?.rows).toHaveLength(3)
  })
})

describe('Rental income after costs', () => {
  test("The rental income after costs on a flat's page", () => {
    const rows = {
      ...flat().rows,
      '2.2': row([{ key: 'maintenance_charge', cents: 141900 }]),
      '2.5': row([{ key: 'insurance', cents: 83600 }]),
    }
    const doc = pdfDocument(view({ flats: [flat({ rows })] }), now)
    const table = find(doc.pages[1].blocks, 'table', 'Vuokratulot ja kulut')
    expect(table?.rows.at(-1)?.map(plain)).toEqual([
      '',
      'Vuokratulot kulujen jälkeen\nEi lomakkeelle 7H',
      '2 640,00 €',
    ])
  })
})

describe('Finnish originals of tax terms', () => {
  test('Originals in the PDF', () => {
    overwriteGetLocale(() => 'en')
    const doc = pdfDocument(view(), now)
    const table = find(doc.pages[1].blocks, 'table', 'Rental income and costs')
    expect(table?.rows[0]?.[1]).toMatch(
      /^Gross rental income \(bruttovuokratulot\)\n/,
    )
    expect(table?.rows[0]?.[1]).toContain('Rent payments')
  })

  test('No originals in Finnish', () => {
    const doc = pdfDocument(view(), now)
    const table = find(doc.pages[1].blocks, 'table', 'Vuokratulot ja kulut')
    expect(table?.rows[1]?.[1]).toMatch(/^Hoitovastikkeet ja vesimaksut\n/)
  })
})

describe("The whole flats' PDF", () => {
  const owners = [
    {
      userId: 'a',
      name: 'Annika Kotivalo',
      share: 5000,
      income: 489500,
      isYou: true,
    },
    {
      userId: 'm',
      name: 'Mikko Virtanen',
      share: 5000,
      income: 489500,
      isYou: false,
    },
  ]
  const whole = pdfDocument(
    view({
      holder: { kind: 'whole' },
      holderName: '',
      cards: [
        card({
          share: 10000,
          income: 979000,
          owners: owners.map(({ name, share, isYou }) => ({
            name,
            share,
            isYou,
          })),
        }),
      ],
      flats: [
        flat({
          owners,
          rows: {
            ...flat().rows,
            '2.1': row([{ key: 'rent_payments', cents: 979000 }]),
          },
        }),
      ],
    }),
    now,
  )

  test("The whole flats' cover", () => {
    expect(whole.band?.title).toBe('Koko asunto tarkistamista varten')
    expect(find(whole.pages[0].blocks, 'pairs')?.rows[0]?.value).toBe(
      'Koko asunnot (100 %)',
    )
    const table = find(whole.pages[0].blocks, 'table')
    expect(table?.header?.[1]).toBe('Omistajat')
    expect(plain(table?.rows[0]?.[1] ?? '')).toBe(
      'Annika Kotivalo 50 % · Mikko Virtanen 50 %',
    )
  })

  test("The whole flat's page", () => {
    const page = whole.pages[1]
    const ownersTable = find(page.blocks, 'table', 'Omistajat')
    expect(ownersTable?.rows.map((cells) => cells.map(plain))).toEqual([
      ['Annika Kotivalo', 'Osuus 50 %', '4 895,00 €'],
      ['Mikko Virtanen', 'Osuus 50 %', '4 895,00 €'],
    ])
    const rows = find(page.blocks, 'table', 'Vuokratulot ja kulut')
    expect(plain(rows?.rows[0]?.[2] ?? '')).toBe('9 790,00 €')
    // No flat details form 7H asks for.
    expect(find(page.blocks, 'pairs')).toBeUndefined()
    expect(find(page.blocks, 'table', 'Vuokralaiset')).toBeUndefined()
  })
})

describe("Text the PDF font can't show", () => {
  const every: Check[] = [
    { kind: 'unpaid', months: ['2025-11', '2025-12'] },
    { kind: 'partly_paid', months: [{ month: '2025-03', missing: 5000 }] },
    { kind: 'vacant', months: ['2025-05'] },
    { kind: 'details_missing', missing: ['name'] },
    { kind: 'treatment_not_set', months: ['2025-02'] },
    { kind: 'share_changed', on: '2025-07-01', from: 5000, to: 10000 },
  ]
  const full = (holder: YearSummaryPdfView['holder']) =>
    view({
      holder,
      holderName: holder.kind === 'whole' ? '' : 'Åsa Öberg',
      notIncluded: [{ propertyId: 'x', streetAddress: 'Åkerögatan 4 Ä' }],
      cards: [
        card({
          checks: every,
          owners: [{ name: 'Åsa Öberg', share: 5000, isYou: true }],
        }),
      ],
      flats: [
        flat({
          checks: every,
          owners: [
            {
              userId: 'a',
              name: 'Åsa Öberg',
              share: 5000,
              income: 1,
              isYou: true,
            },
          ],
          rows: {
            ...flat().rows,
            '2.3': row([{ key: 'financing_charge', cents: 50000 }]),
          },
          outside: { capitalised: 1, improvements: 1, depositDamage: 1 },
        }),
      ],
    })

  test("The PDF's messages need no replacement", () => {
    const holders = [
      { kind: 'own' },
      { kind: 'person', userId: 'a', name: 'Åsa Öberg' },
      { kind: 'whole' },
    ] as const
    for (const locale of ['fi', 'sv', 'en'] as const) {
      overwriteGetLocale(() => locale)
      for (const holder of holders) {
        for (const text of strings(pdfDocument(full(holder), now))) {
          expect(pdfText(text)).toBe(text)
        }
      }
    }
  })
})
