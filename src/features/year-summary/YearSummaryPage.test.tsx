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
      search: { year: number }
    }) => (
      <a
        href={`${props.to.replace('$propertyId', props.params.propertyId)}?year=${String(props.search.year)}`}
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
  ...over,
})

const view = (over: Partial<YearSummaryView> = {}): YearSummaryView => ({
  today: '2026-11-25',
  year: 2025,
  years: [2024, 2025, 2026],
  flats: [card()],
  notIncluded: [],
  ...over,
})

function renderPage(v: YearSummaryView, onYear = vi.fn()) {
  render(<YearSummaryPage view={v} onYear={onYear} bottomNav={null} />)
  return onYear
}

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
