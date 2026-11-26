import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { FlatCard, YearSummaryView } from './view'
import { YearSummaryPage } from './YearSummaryPage'

// jsdom's browser language is English. Links render as plain anchors with
// the address the router would build; the router isn't under test here.
vi.mock('@tanstack/react-router', () => ({
  createLink:
    () =>
    (props: {
      children: ReactNode
      to: string
      params: { propertyId: string }
      search: { year: number; person?: string }
    }) => (
      <a
        href={`${props.to.replace('$propertyId', props.params.propertyId)}?year=${String(props.search.year)}${props.search.person ? `&person=${props.search.person}` : ''}`}
      >
        {props.children}
      </a>
    ),
}))
const card = (over: Partial<FlatCard> = {}): FlatCard => ({
  propertyId: 'kuusikuja',
  streetAddress: 'Kuusikuja 3 B 12',
  housingCompanyName: 'As Oy Kuusikuja 3',
  businessId: '0112038-9',
  share: 5000,
  income: 489500,
  costs: 225500,
  checks: [],
  owners: [],
  ...over,
})

const view = (over: Partial<YearSummaryView> = {}): YearSummaryView => ({
  today: '2026-11-25',
  year: 2025,
  years: [2024, 2025, 2026],
  holder: { kind: 'own' },
  people: [],
  counts: { own: 1, whole: 1 },
  holderHasYears: true,
  flats: [card()],
  notIncluded: [],
  ...over,
})

function renderPage(v: YearSummaryView, onYear = vi.fn(), onPerson = vi.fn()) {
  render(
    <YearSummaryPage
      view={v}
      onYear={onYear}
      onPerson={onPerson}
      bottomNav={null}
    />,
  )
  return onYear
}

const MIKKO = {
  kind: 'person',
  userId: 'mikko',
  name: 'Mikko Virtanen',
} as const

describe('The year summary page', () => {
  test('shows a card per flat in address order with its figures', () => {
    renderPage(
      view({
        flats: [
          card({ propertyId: 'r', streetAddress: 'Rantatie 15 C 21' }),
          card(),
        ],
      }),
    )
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/year-summary/kuusikuja?year=2025',
      '/year-summary/r?year=2025',
    ])
    const first = links[0]
    expect(within(first).getByText('Kuusikuja 3 B 12')).toBeVisible()
    expect(
      within(first).getByText('As Oy Kuusikuja 3 · Business ID 0112038-9'),
    ).toBeVisible()
    expect(within(first).getByText('Your share 50%')).toBeVisible()
    expect(within(first).getByText('€4,895.00')).toBeVisible()
    expect(within(first).getByText('€2,255.00')).toBeVisible()
  })

  test('names missing housing company details and the checks as chips', () => {
    renderPage(
      view({
        flats: [
          card({
            housingCompanyName: null,
            businessId: null,
            checks: [
              { kind: 'unpaid', months: ['2025-12'] },
              { kind: 'vacant', months: ['2025-10', '2025-11', '2025-12'] },
              {
                kind: 'details_missing',
                missing: ['name', 'business_id', 'apartment_number'],
              },
              {
                kind: 'share_changed',
                on: '2025-07-01',
                from: 5000,
                to: 10000,
              },
            ],
          }),
        ],
      }),
    )
    expect(
      screen.getByText('Housing company and Business ID missing'),
    ).toBeVisible()
    for (const text of [
      'Rent not recorded for 1 month',
      'Vacant 3 months',
      'Housing company details missing',
    ]) {
      expect(screen.getByText(text)).toBeVisible()
    }
    expect(screen.getByText(/^Share changed 0?1\/0?7$/)).toBeVisible()
  })

  test('shows a chip for each share change', () => {
    renderPage(
      view({
        flats: [
          card({
            checks: [
              { kind: 'share_changed', on: '2025-03-01', from: 0, to: 5000 },
              {
                kind: 'share_changed',
                on: '2025-09-01',
                from: 5000,
                to: 10000,
              },
            ],
          }),
        ],
      }),
    )
    expect(screen.getAllByText(/^Share changed/)).toHaveLength(2)
  })

  test('names the flats not included and what the figures leave out', () => {
    renderPage(
      view({
        notIncluded: [
          { propertyId: 'p', streetAddress: 'Pyynikintie 5 A 3' },
          { propertyId: 'h', streetAddress: 'Hallilantie 12 B 8' },
        ],
      }),
    )
    expect(
      screen.getByText(
        'Not included: Hallilantie 12 B 8 and Pyynikintie 5 A 3, because you had no ownership share in them in 2025.',
      ),
    ).toBeVisible()
    expect(screen.getByText(/leave out loan interest/)).toBeVisible()
  })

  test('says there was no share in any flat', () => {
    renderPage(
      view({
        years: [],
        flats: [],
        notIncluded: [{ propertyId: 'k', streetAddress: 'Kuusikuja 3 B 12' }],
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'No ownership share in 2025' }),
    ).toBeVisible()
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled()
  })

  test('moves between years and disables the buttons at the ends', async () => {
    const onYear = renderPage(view({ year: 2024 }))
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next year' }))
    expect(onYear).toHaveBeenCalledWith(2025)
  })

  test('names the months counted in the current year', () => {
    renderPage(view({ year: 2026 }))
    expect(screen.getByText('January–November')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled()
  })
})

describe('Choosing whose figures', () => {
  test('shows no selector without other owners', () => {
    renderPage(view())
    expect(
      screen.queryByRole('button', { name: /Whose figures/ }),
    ).not.toBeInTheDocument()
  })

  test("shows another owner's cards with the share, the band and the note", () => {
    renderPage(
      view({
        holder: MIKKO,
        people: [{ userId: 'mikko', name: 'Mikko Virtanen', flats: 1 }],
        notIncluded: [{ propertyId: 'k', streetAddress: 'Koivupolku 7 A 4' }],
      }),
    )
    expect(screen.getByText('Share: Mikko Virtanen · 1 flat')).toBeVisible()
    expect(screen.getByText('Shared flats only')).toBeVisible()
    expect(screen.getByText(/may have other rental flats/)).toBeVisible()
    expect(screen.getByText('Share 50%')).toBeVisible()
    expect(
      screen.getByText(
        'Not included: Koivupolku 7 A 4, because Mikko Virtanen had no ownership share in it in 2025.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/year-summary/kuusikuja?year=2025&person=mikko',
    )
  })

  test("shows the whole flats' owners on the cards and the note", () => {
    renderPage(
      view({
        holder: { kind: 'whole' },
        people: [{ userId: 'mikko', name: 'Mikko Virtanen', flats: 1 }],
        flats: [
          card({
            share: 10000,
            owners: [
              { name: 'Annika', share: 5000, isYou: true },
              { name: 'Mikko Virtanen', share: 5000, isYou: false },
            ],
          }),
        ],
      }),
    )
    expect(screen.getByText('Whole flats · 1 flat')).toBeVisible()
    expect(screen.getByText(/are not reported as such/)).toBeVisible()
    expect(screen.getByText('Annika 50% · Mikko Virtanen 50%')).toBeVisible()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/year-summary/kuusikuja?year=2025&person=whole',
    )
  })

  test('says a person had no share that year and keeps the selector', () => {
    renderPage(
      view({
        holder: MIKKO,
        people: [{ userId: 'mikko', name: 'Mikko Virtanen', flats: 0 }],
        flats: [],
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'No ownership share in 2025' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Mikko Virtanen had no ownership share in any of the flats you see in 2025.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /Whose figures/ })).toBeVisible()
  })
})
