// The year summary PDF as a document model (openspec: year-summary, design
// decision 4): pages of blocks with every text already in the user's language
// and the app's formats. It is pure and knows no PDF library, so Vitest can
// check what the PDF says; pdf-render.ts only draws it.
import { sortByStreetAddress } from '#/features/properties/property'
import {
  formatDate,
  formatDay,
  formatDayMonth,
  formatList,
  formatMoney,
  formatShare,
} from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { checkText } from './check-text'
import { partsText, rowLabel } from './row-text'
import { ROW_NUMBERS, type Check } from './summary'
import type { FlatCard, HolderView, PdfFlat, YearSummaryPdfView } from './view'

/** A table column; `stacked` draws the lines after the first one muted. */
export interface PdfColumn {
  align: 'left' | 'right'
  /** Share of the table's width. */
  width: number
  stacked?: boolean
}

export type PdfBlock =
  | { kind: 'pairs'; title?: string; rows: { label: string; value: string }[] }
  | {
      kind: 'table'
      title?: string
      /** Shown at the right of the title. */
      tag?: string
      columns: PdfColumn[]
      header?: string[]
      /** A cell may have several lines, told apart by a line break. */
      rows: string[][]
    }
  | { kind: 'notes'; title: string; items: { title: string; text: string }[] }
  | { kind: 'paragraph'; text: string; muted?: boolean }

export interface PdfPage {
  /** `cover`, or the flat's id. */
  id: string
  kicker: string
  title: string
  /** Shown at the right of the title: the day the PDF was made. */
  aside?: string
  blocks: PdfBlock[]
}

export interface PdfDocument {
  /** Drawn on every page: the whole flats are for checking only. */
  band: { title: string; text: string } | null
  /** The cover first, then a page per flat. A long page continues. */
  pages: PdfPage[]
  /** The footer of a page; the renderer knows the page count. */
  footer: (page: number, pages: number) => string
}

const wholeFlats = (view: YearSummaryPdfView) => view.holder.kind === 'whole'
const ownShare = (view: YearSummaryPdfView) => view.holder.kind === 'own'

/** Whose figures, as one line. */
function holderText(view: YearSummaryPdfView): string {
  switch (view.holder.kind) {
    case 'own':
      return m.pdf_holder_own({ name: view.holderName })
    case 'person':
      return view.holder.name
    case 'whole':
      return m.year_summary_holder_whole()
  }
}

function kicker(holder: HolderView, year: number): string {
  switch (holder.kind) {
    case 'own':
      return m.flat_tax_kicker({ year })
    case 'whole':
      return m.flat_tax_kicker_whole({ year })
    case 'person':
      return m.flat_tax_kicker_person({ year, name: holder.name })
  }
}

/** 1 January to 31 December, or to today in the current year. */
function period(view: YearSummaryPdfView): string {
  const year = String(view.year)
  const end = `${year}-12-31`
  return m.flat_tax_period_value({
    from: formatDayMonth(`${year}-01-01`),
    to: formatDate(
      view.today < end && view.today.startsWith(year) ? view.today : end,
    ),
  })
}

function companyLine(card: FlatCard): string {
  const { housingCompanyName: name, businessId } = card
  if (name && businessId) {
    return m.year_summary_company({ name, businessId })
  }
  if (name) {
    return m.year_summary_company_no_business_id({ name })
  }
  if (businessId) {
    return m.year_summary_company_no_name({ businessId })
  }
  return m.year_summary_company_missing()
}

/** `50 % – 100 %` when the share changed in the year. */
function shareText(card: FlatCard): string {
  const changes = card.checks.filter(
    (check): check is Extract<Check, { kind: 'share_changed' }> =>
      check.kind === 'share_changed',
  )
  const first = changes.at(0)
  const last = changes.at(-1)
  return first && last
    ? `${formatShare(first.from)} – ${formatShare(last.to)}`
    : formatShare(card.share)
}

function notIncludedText(view: YearSummaryPdfView): string {
  const flats = formatList(view.notIncluded.map((flat) => flat.streetAddress))
  const count = view.notIncluded.length
  const year = String(view.year)
  return view.holder.kind === 'person'
    ? m.year_summary_person_not_included({
        count,
        flats,
        name: view.holder.name,
        year,
      })
    : m.year_summary_not_included({ count, flats, year })
}

function cover(
  view: YearSummaryPdfView,
  now: Date,
  flats: readonly PdfFlat[],
  pageOf: (propertyId: string) => number,
): PdfPage {
  const whole = wholeFlats(view)
  const cards = new Map(view.cards.map((card) => [card.propertyId, card]))
  const rows = flats.flatMap((flat) => {
    const card = cards.get(flat.propertyId)
    if (!card) {
      return []
    }
    const lines = [flat.streetAddress, companyLine(card)]
    if (card.checks.length > 0) {
      lines.push(m.pdf_checks({ count: card.checks.length }))
    }
    return [
      [
        lines.join('\n'),
        whole
          ? card.owners
              .map((owner) =>
                m.year_summary_owner_share({
                  name: owner.name,
                  share: formatShare(owner.share),
                }),
              )
              .join('\n')
          : shareText(card),
        formatMoney(card.income),
        formatMoney(card.costs),
        String(pageOf(flat.propertyId)),
      ],
    ]
  })
  const blocks: PdfBlock[] = [
    {
      kind: 'pairs',
      rows: [
        { label: m.year_summary_holder_label(), value: holderText(view) },
        { label: m.pdf_period(), value: period(view) },
      ],
    },
    {
      kind: 'table',
      columns: [
        { align: 'left', width: whole ? 0.3 : 0.4, stacked: true },
        { align: 'left', width: whole ? 0.26 : 0.14 },
        { align: 'right', width: whole ? 0.17 : 0.17 },
        { align: 'right', width: whole ? 0.17 : 0.17 },
        { align: 'right', width: whole ? 0.1 : 0.12 },
      ],
      header: [
        m.pdf_column_flat(),
        whole ? m.flat_tax_owners() : m.pdf_column_share(),
        m.year_summary_income(),
        m.year_summary_costs(),
        m.pdf_column_page(),
      ],
      rows,
    },
  ]
  if (view.notIncluded.length > 0) {
    blocks.push({ kind: 'paragraph', text: notIncludedText(view) })
  }
  blocks.push(
    { kind: 'paragraph', text: m.year_summary_not_counted() },
    { kind: 'paragraph', text: m.pdf_cover_note(), muted: true },
  )
  return {
    id: 'cover',
    kicker: m.pdf_subtitle(),
    title: m.pdf_title({ year: view.year }),
    aside: m.pdf_made({ date: formatDay(now) }),
    blocks,
  }
}

const periodOf = (from: string, to: string) =>
  m.flat_tax_period_value({
    from: formatDayMonth(from),
    to: formatDate(to),
  })

function flatPage(view: YearSummaryPdfView, flat: PdfFlat): PdfPage {
  const whole = wholeFlats(view)
  const year = String(view.year)
  const { details } = flat
  const missing = (value: string | null) => value ?? m.flat_tax_missing()
  const blocks: PdfBlock[] = []

  if (flat.checks.length > 0) {
    blocks.push({
      kind: 'notes',
      title: m.flat_tax_checks(),
      items: flat.checks.map((check) =>
        checkText(check, { own: ownShare(view), pdf: true }),
      ),
    })
  }

  if (whole) {
    blocks.push({
      kind: 'table',
      title: m.flat_tax_owners(),
      columns: [
        { align: 'left', width: 0.6 },
        { align: 'left', width: 0.2 },
        { align: 'right', width: 0.2 },
      ],
      rows: flat.owners.map((owner) => [
        owner.name,
        m.year_summary_share_person({ share: formatShare(owner.share) }),
        formatMoney(owner.income),
      ]),
    })
  } else {
    blocks.push({
      kind: 'pairs',
      title: m.flat_tax_details(),
      rows: [
        {
          label: m.flat_tax_housing_company_name(),
          value: missing(details.name),
        },
        { label: m.flat_tax_business_id(), value: missing(details.businessId) },
        {
          label: m.flat_tax_apartment_number(),
          value: missing(details.apartmentNumber),
        },
        {
          label: m.flat_tax_identity_code(),
          value: m.flat_tax_identity_code_text(),
        },
        { label: m.flat_tax_share(), value: formatShare(details.share) },
      ],
    })
    blocks.push(
      details.tenancies.length > 0
        ? {
            kind: 'table',
            title: m.pdf_tenants(),
            columns: [
              { align: 'left', width: 0.6 },
              { align: 'left', width: 0.4 },
            ],
            rows: details.tenancies.map((tenancy) => [
              tenancy.name,
              periodOf(tenancy.from, tenancy.to),
            ]),
          }
        : { kind: 'paragraph', text: m.flat_tax_tenant_none({ year }) },
    )
  }

  blocks.push({
    kind: 'table',
    title: m.flat_tax_rows(),
    tag: m.flat_tax_rows_share({ share: formatShare(details.share) }),
    columns: [
      { align: 'left', width: 0.1 },
      { align: 'left', width: 0.7, stacked: true },
      { align: 'right', width: 0.2 },
    ],
    rows: ROW_NUMBERS.map((number) => {
      const row = flat.rows[number]
      const lines = [
        rowLabel[number](),
        row.parts.length > 0 ? partsText(row.parts) : m.flat_tax_no_parts(),
      ]
      if (number === '2.3' && row.cents > 0) {
        lines.push(m.flat_tax_case_law())
      }
      return [number, lines.join('\n'), formatMoney(row.cents)]
    }),
  })

  const outside = [
    [
      flat.outside.capitalised,
      m.flat_tax_outside_capitalised(),
      m.flat_tax_outside_capitalised_text(),
    ],
    [
      flat.outside.improvements,
      m.flat_tax_outside_improvements(),
      m.flat_tax_outside_improvements_text(),
    ],
    [
      flat.outside.depositDamage,
      m.flat_tax_outside_deposit_damage(),
      m.flat_tax_outside_deposit_damage_text(),
    ],
  ].filter(([cents]) => Number(cents) > 0)
  if (outside.length > 0) {
    blocks.push({
      kind: 'table',
      title: m.flat_tax_outside(),
      columns: [
        { align: 'left', width: 0.8, stacked: true },
        { align: 'right', width: 0.2 },
      ],
      rows: outside.map(([cents, label, text]) => [
        `${String(label)}\n${String(text)}`,
        formatMoney(Number(cents)),
      ]),
    })
  }
  blocks.push({ kind: 'paragraph', text: m.flat_tax_note(), muted: true })

  return {
    id: flat.propertyId,
    kicker: kicker(view.holder, view.year),
    title: flat.streetAddress,
    aside: `${flat.postcode} ${flat.city}`,
    blocks,
  }
}

/**
 * The PDF of the year. `firstPages` maps a flat's id to the page its pages
 * start on; without it each flat is taken to fit on one page, after the cover.
 */
export function pdfDocument(
  view: YearSummaryPdfView,
  now: Date,
  firstPages?: Readonly<Record<string, number>>,
): PdfDocument {
  const flats = sortByStreetAddress(view.flats, getLocale())
  const pageOf = (propertyId: string) =>
    firstPages?.[propertyId] ??
    2 + flats.findIndex((flat) => flat.propertyId === propertyId)
  const holder = holderText(view)
  return {
    band: wholeFlats(view)
      ? {
          title: m.flat_tax_band_whole_title(),
          text: m.flat_tax_band_whole_text(),
        }
      : null,
    pages: [
      cover(view, now, flats, pageOf),
      ...flats.map((flat) => flatPage(view, flat)),
    ],
    footer: (page, pages) =>
      m.pdf_footer({ year: view.year, holder, page, pages }),
  }
}
