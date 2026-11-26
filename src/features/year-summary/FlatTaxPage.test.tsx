import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { clientLog } from '#/lib/client-log'
import { FlatTaxPage } from './FlatTaxPage'
import type { FlatYear, Row } from './summary'
import type { FlatYearView } from './view'

// jsdom's browser language is English. Links render as plain anchors; the
// router isn't under test here.
vi.mock('@tanstack/react-router', () => ({
  createLink:
    () =>
    (props: {
      children: ReactNode
      to: string
      params?: { propertyId: string }
      search?: { person?: string }
      'aria-label'?: string
    }) => (
      <a
        href={props.to.replace('$propertyId', props.params?.propertyId ?? '')}
        data-person={props.search?.person}
        aria-label={props['aria-label']}
      >
        {props.children}
      </a>
    ),
}))

vi.mock('#/lib/client-log', () => ({
  clientLog: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const row = (cents: number, parts: Row['parts'] = []): Row => ({
  cents,
  parts,
})

type Flat = Omit<FlatYear, 'propertyId' | 'included'>

const flat = (over: Partial<Flat> = {}): Flat => ({
  rows: {
    '2.1': row(489500, [{ key: 'rent_payments', cents: 489500 }]),
    '2.2': row(141900, [
      { key: 'maintenance_charge', cents: 117700 },
      { key: 'water', cents: 24200 },
    ]),
    '2.3': row(0),
    '2.4': row(67100, [{ key: 'annual_repair', cents: 67100 }]),
    '2.5': row(16500, [
      { key: 'insurance', cents: 9300 },
      { key: 'parking', cents: 7200 },
    ]),
  },
  outside: { capitalised: 0, improvements: 0, depositDamage: 0 },
  details: {
    name: 'As Oy Kuusikuja 3',
    businessId: '0112038-9',
    apartmentNumber: 'B 12',
    tenant: { kind: 'one', name: 'Aino Koski' },
    period: { from: '2025-01-01', to: '2025-09-30' },
    share: 5000,
  },
  checks: [],
  ...over,
})

const view = (
  f: Flat | null = flat(),
): Extract<FlatYearView, { ok: true }> => ({
  ok: true,
  today: '2026-11-25',
  year: 2025,
  property: {
    id: 'kuusikuja',
    streetAddress: 'Kuusikuja 3 B 12',
    postcode: '33100',
    city: 'Tampere',
  },
  holder: { kind: 'own' },
  owners: [],
  flat: f,
})

/** A row of the form, by its number. */
function rowOf(number: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[data-row="${number}"]`)
  if (row === null) {
    throw new Error(`No row ${number}`)
  }
  return row
}

describe('The form 7H page of a flat', () => {
  test('shows the rows with their names, parts and amounts', () => {
    render(<FlatTaxPage view={view()} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Kuusikuja 3 B 12' }),
    ).toBeVisible()
    const first = within(rowOf('2.1'))
    expect(first.getByText('Gross rental income')).toBeVisible()
    expect(first.getByText('Rent payments €4,895.00')).toBeVisible()
    expect(first.getByText('€4,895.00')).toBeVisible()
    expect(
      within(rowOf('2.2')).getByText(
        'Maintenance charge €1,177.00 · Water charge (usage charge) €242.00',
      ),
    ).toBeVisible()
    expect(
      within(rowOf('2.5')).getByText(
        'Insurance €93.00 · Parking space (usage charge) €72.00',
      ),
    ).toBeVisible()
    expect(within(rowOf('2.3')).getByText('No entries')).toBeVisible()
    expect(screen.queryByText(/case law/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Not on form 7H' })).toBeNull()
    expect(screen.getByText(/counted by payment date/)).toBeVisible()
  })

  test('The case law note under row 2.3', () => {
    const rows = {
      ...flat().rows,
      '2.3': row(36300, [{ key: 'financing_charge', cents: 36300 }]),
    }
    render(<FlatTaxPage view={view(flat({ rows }))} />)
    expect(
      within(rowOf('2.3')).getByText(/not always been accepted in case law/),
    ).toBeVisible()
  })

  test('shows what is not on form 7H', () => {
    render(
      <FlatTaxPage
        view={view(
          flat({
            outside: {
              capitalised: 47298,
              improvements: 60000,
              depositDamage: 0,
            },
          }),
        )}
      />,
    )
    const card = screen.getByRole('region', { name: 'Not on form 7H' })
    expect(within(card).getByText('€472.98')).toBeVisible()
    expect(within(card).getByText('€600.00')).toBeVisible()
  })

  test('shows damage compensation over the repairs as tax-free', () => {
    render(
      <FlatTaxPage
        view={view(
          flat({
            outside: { capitalised: 0, improvements: 0, depositDamage: 5000 },
          }),
        )}
      />,
    )
    const card = screen.getByRole('region', { name: 'Not on form 7H' })
    expect(
      within(card).getByText('Damage compensated from the deposit'),
    ).toBeVisible()
    expect(within(card).getByText('€50.00')).toBeVisible()
    expect(within(card).getByText(/Tax-free compensation/)).toBeVisible()
  })

  test('names the damage compensation as a negative part of row 2.4', () => {
    const rows = {
      ...flat().rows,
      '2.4': row(20000, [
        { key: 'annual_repair', cents: 30000 },
        { key: 'deposit_damage', cents: -10000 },
      ]),
    }
    render(<FlatTaxPage view={view(flat({ rows }))} />)
    expect(
      within(rowOf('2.4')).getByText(/Damage compensated from the deposit/),
    ).toBeVisible()
  })

  test('A flat without a share that year', () => {
    render(<FlatTaxPage view={view(null)} />)
    expect(
      screen.getByRole('heading', { name: 'No ownership share in 2025' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Gross rental income' }),
    ).toBeNull()
  })
})

describe('Flat details for form 7H', () => {
  test('shows the details with the tenancy period and share', () => {
    render(<FlatTaxPage view={view()} />)
    const details = screen.getByRole('region', { name: 'Flat details' })
    expect(within(details).getByText('Aino Koski')).toBeVisible()
    expect(within(details).getByText(/^0?1\/0?1–30\/0?9\/2025$/)).toBeVisible()
    expect(within(details).getByText('50%')).toBeVisible()
    expect(
      within(details).getByText('Not stored in Kotivalo. Fill it in on MyTax.'),
    ).toBeVisible()
    expect(
      within(details).queryByRole('button', {
        name: "Copy: Tenant's personal identity code",
      }),
    ).toBeNull()
  })

  test('Missing housing company details', () => {
    render(
      <FlatTaxPage
        view={view(
          flat({
            details: {
              ...flat().details,
              name: null,
              businessId: null,
              apartmentNumber: null,
            },
          }),
        )}
      />,
    )
    for (const detail of [
      'Housing company name',
      'Business ID',
      'Apartment number',
    ]) {
      expect(
        screen.getByRole('link', { name: `Add: ${detail}` }),
      ).toHaveAttribute('href', '/properties/kuusikuja/edit')
      expect(
        screen.queryByRole('button', { name: `Copy: ${detail}` }),
      ).toBeNull()
    }
  })

  test('Several tenancies in the year', () => {
    render(
      <FlatTaxPage
        view={view(
          flat({
            details: {
              ...flat().details,
              tenant: { kind: 'several' },
              period: { from: '2025-01-01', to: '2025-12-31' },
            },
          }),
        )}
      />,
    )
    expect(screen.getByText('Several')).toBeVisible()
  })
})

describe('Checks in the year summary', () => {
  test('lists each check with its explanation and link', () => {
    render(
      <FlatTaxPage
        view={view(
          flat({
            checks: [
              { kind: 'unpaid', months: ['2025-12'] },
              {
                kind: 'partly_paid',
                months: [{ month: '2025-11', missing: 39000 }],
              },
              { kind: 'treatment_not_set', months: ['2025-01', '2025-02'] },
              {
                kind: 'share_changed',
                on: '2025-07-01',
                from: 5000,
                to: 10000,
              },
            ],
          }),
        )}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'Rent not recorded: December 2025' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', {
        name: 'Rent partly paid: November 2025 (€390.00 missing)',
      }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('link', { name: 'Open rent payments' })[0],
    ).toHaveAttribute('href', '/properties/kuusikuja/rent')
    expect(screen.getByRole('link', { name: 'Open charges' })).toHaveAttribute(
      'href',
      '/properties/kuusikuja/amounts',
    )
    expect(
      screen.getByRole('heading', {
        name: 'Financing charge treatment missing for 2 months',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', {
        name: /^Your share changed on .*: 50% → 100%$/,
      }),
    ).toBeVisible()
  })
})

describe('Copying form 7H values', () => {
  test('copies an amount in the MyTax format and says so', async () => {
    const writeClipboard = vi.fn(() => Promise.resolve())
    render(<FlatTaxPage view={view()} writeClipboard={writeClipboard} />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy row 2.1' }))
    expect(writeClipboard).toHaveBeenCalledWith('4895,00')
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Copied: 4895,00',
    )
  })

  test('copies the share and a text value as shown', async () => {
    const writeClipboard = vi.fn(() => Promise.resolve())
    render(<FlatTaxPage view={view()} writeClipboard={writeClipboard} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Copy: Ownership share' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Copy: Business ID' }),
    )
    expect(writeClipboard.mock.calls).toEqual([['50'], ['0112038-9']])
  })

  test('says copying failed and logs it without the value', async () => {
    const writeClipboard = vi.fn(() => Promise.reject(new Error('denied')))
    render(<FlatTaxPage view={view()} writeClipboard={writeClipboard} />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy row 2.2' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Copying failed. Type the figure in by hand.',
    )
    expect(clientLog.warn).toHaveBeenCalledWith('year_summary.copy_failed')
  })

  test('says copying failed when the clipboard is missing', async () => {
    // Outside a secure context navigator.clipboard is undefined, so the
    // write throws before it returns a promise.
    const writeClipboard = vi.fn((): Promise<void> => {
      throw new TypeError('navigator.clipboard is undefined')
    })
    render(<FlatTaxPage view={view()} writeClipboard={writeClipboard} />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy row 2.2' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Copying failed. Type the figure in by hand.',
    )
    expect(clientLog.warn).toHaveBeenCalledWith('year_summary.copy_failed')
  })
})

const MIKKO = {
  kind: 'person',
  userId: 'mikko',
  name: 'Mikko Virtanen',
} as const

describe("Another owner's figures", () => {
  test("A co-owner's form 7H page", () => {
    render(
      <FlatTaxPage
        view={{
          ...view(
            flat({
              checks: [
                { kind: 'share_changed', on: '2025-03-01', from: 0, to: 5000 },
              ],
            }),
          ),
          holder: MIKKO,
        }}
      />,
    )
    expect(screen.getByText('Form 7H · 2025 · Mikko Virtanen')).toBeVisible()
    expect(screen.getByText('Share: Mikko Virtanen')).toBeVisible()
    expect(screen.getByText(/may have other rental flats/)).toBeVisible()
    expect(screen.getByText(/The share changed on .*: 0% → 50%/)).toBeVisible()
    expect(screen.queryByText(/Your share changed/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy row 2.1' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Flat details' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Back to the year summary' }),
    ).toHaveAttribute('data-person', 'mikko')
  })

  test('says a person had no share in the flat that year', () => {
    render(<FlatTaxPage view={{ ...view(null), holder: MIKKO }} />)
    expect(
      screen.getByText(
        'Mikko Virtanen had no ownership share in this flat in 2025, so there are no figures for form 7H.',
      ),
    ).toBeVisible()
  })
})

describe("The whole flat's page", () => {
  const wholeView = (): Extract<FlatYearView, { ok: true }> => ({
    ...view(flat({ details: { ...flat().details, share: 10000 } })),
    holder: { kind: 'whole' },
    owners: [
      {
        userId: 'annika',
        name: 'Annika',
        share: 5000,
        income: 244750,
        isYou: true,
      },
      {
        userId: 'mikko',
        name: 'Mikko Virtanen',
        share: 5000,
        income: 244750,
        isYou: false,
      },
    ],
  })

  test('shows the owners and the rows with no copy button and no details', () => {
    render(<FlatTaxPage view={wholeView()} />)
    expect(screen.getByText('The whole flat, for checking')).toBeVisible()
    expect(screen.getByText(/not reported as such/)).toBeVisible()
    const owners = screen.getByRole('region', { name: 'Owners' })
    expect(within(owners).getByText('Annika')).toBeVisible()
    expect(within(owners).getByText('Mikko Virtanen')).toBeVisible()
    expect(within(owners).getAllByText('Share 50%')).toHaveLength(2)
    expect(within(rowOf('2.1')).getByText('€4,895.00')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Copy/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Flat details' })).toBeNull()
  })

  test('Opening an owner from the whole flat', () => {
    render(<FlatTaxPage view={wholeView()} />)
    const owners = screen.getByRole('region', { name: 'Owners' })
    const links = within(owners).getAllByRole('link')
    // The user's own page has no person; another owner's has their id.
    expect(links.map((link) => link.getAttribute('data-person'))).toEqual([
      null,
      'mikko',
    ])
    expect(
      screen.getByRole('link', { name: 'Back to the year summary' }),
    ).toHaveAttribute('data-person', 'whole')
  })
})
