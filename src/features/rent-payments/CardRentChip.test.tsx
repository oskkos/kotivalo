import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { Period } from '#/features/recurring-amounts/periods'
import { CardRentChip } from './CardRentChip'
import { rentThisMonth, type PaymentOfMonth } from './status'

// jsdom's browser language is English.
const tenancy = (id: string, validFrom = '2025-03-01') => ({
  id,
  validFrom,
  validTo: null,
  dueDay: 5,
  contractType: 'open_ended' as const,
  termEnd: null,
  noticeGivenBy: null,
  noticeDate: null,
})
const rent: Period<number>[] = [
  { validFrom: '2025-03-01', validTo: null, value: 89000 },
]
const paid = (tenancyId: string, amount: number): PaymentOfMonth => ({
  tenancyId,
  month: '2026-11',
  amount,
  paidOn: '2026-11-03',
})

/** The chip texts of the flats by id, as the flats list shows them. */
function chips(
  flats: Parameters<typeof rentThisMonth<ReturnType<typeof tenancy>>>[0],
  today: string,
) {
  const { rows } = rentThisMonth(flats, today)
  return Object.fromEntries(
    flats.map(({ propertyId }) => {
      const row = rows[propertyId]
      if (!row) {
        return [propertyId, null]
      }
      const { unmount } = render(<CardRentChip row={row} />)
      const text = document.body.textContent
      unmount()
      return [propertyId, text]
    }),
  )
}

describe("The rent status on a flat's card", () => {
  test('A late month shows on the card', () => {
    render(
      <CardRentChip
        row={
          rentThisMonth(
            [
              {
                propertyId: 'kuusikuja',
                tenancies: [tenancy('aino')],
                rentPeriods: rent,
                payments: [],
              },
            ],
            '2026-11-22',
          ).rows.kuusikuja ?? never()
        }
      />,
    )
    expect(screen.getByText('17 days late')).toBeVisible()
  })

  test('The card shows paid, partly paid and due', () => {
    expect(
      chips(
        [
          {
            propertyId: 'paid',
            tenancies: [tenancy('a')],
            rentPeriods: rent,
            payments: [paid('a', 89000)],
          },
          {
            propertyId: 'partly',
            tenancies: [tenancy('b')],
            rentPeriods: rent,
            payments: [paid('b', 50000)],
          },
        ],
        '2026-11-22',
      ),
    ).toEqual({ paid: 'Paid', partly: 'Partly paid' })
    expect(
      chips(
        [
          {
            propertyId: 'due',
            tenancies: [tenancy('c')],
            rentPeriods: rent,
            payments: [],
          },
        ],
        '2026-11-03',
      ),
    ).toMatchObject({ due: /^Due / })
  })

  test('A card without a rent set', () => {
    expect(
      chips(
        [
          {
            propertyId: 'flat',
            tenancies: [tenancy('a')],
            rentPeriods: [],
            payments: [],
          },
        ],
        '2026-11-22',
      ),
    ).toEqual({ flat: 'Rent not set' })
  })

  test('A vacant flat has no rent status', () => {
    expect(
      chips(
        [
          {
            propertyId: 'koivupolku',
            tenancies: [],
            rentPeriods: [],
            payments: [],
          },
          {
            propertyId: 'rantatie',
            tenancies: [tenancy('a', '2026-12-01')],
            rentPeriods: rent,
            payments: [],
          },
        ],
        '2026-11-22',
      ),
    ).toEqual({ koivupolku: null, rantatie: null })
  })
})

function never(): never {
  throw new Error('no row')
}
