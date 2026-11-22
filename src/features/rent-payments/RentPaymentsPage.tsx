// A flat's rent payments by year (Design canvas: Vuokranmaksut; openspec:
// rent-payments, "The rent payments page"): the rent received in the year by
// payment date, the months with their statuses, newest first, and a warning
// for the months not fully paid.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { monthOf } from '#/features/recurring-amounts/periods'
import type { Period } from '#/features/recurring-amounts/periods'
import type { Tenancy } from '#/features/tenancies/tenancy.repository.server'
import {
  formatDayMonth,
  formatMoney,
  formatMonth,
  formatMonthName,
} from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { statusText } from './labels'
import type { RentPayment } from './rent-payment.repository.server'
import {
  monthsNotFullyPaid,
  rentMonths,
  tenancyMonths,
  type RentMonth,
} from './status'
import { StatusChip } from './StatusChip'

export interface RentPaymentsPageView {
  today: string
  /** Newest first. */
  tenancies: Tenancy[]
  rents: Period<number>[]
  payments: RentPayment[]
}

interface Props {
  view: RentPaymentsPageView
  propertyId: string
  address: string
  /** The year shown; the current year when not chosen. */
  year: number | undefined
  onBack: () => void
  onYear: (year: number) => void
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

const RowLink = createLink(Link)

function Icon(props: { path: string; size?: number }) {
  const size = props.size ?? 24
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={props.path} />
    </svg>
  )
}

const BACK = 'M15 5 L8 12 L15 19'
const NEXT = 'M9 5 L16 12 L9 19'
const ALERT = 'M12 3 L22 20 H2 Z M12 10 V14 M12 17 V17.01'

/** The years to choose from: those in which a tenancy ran, newest first. */
export function rentYears(tenancies: readonly Tenancy[], today: string) {
  const current = Number(today.slice(0, 4))
  const first = Math.min(
    current,
    ...tenancies.map((t) => Number(t.validFrom.slice(0, 4))),
  )
  const years: number[] = []
  for (let year = current; year >= first; year--) {
    const to = year === current ? monthOf(today) : `${String(year)}-12`
    if (
      tenancies.some((t) => tenancyMonths(t, `${String(year)}-01`, to).length)
    ) {
      years.push(year)
    }
  }
  return years
}

/** The short status a row of the list shows. */
function shortStatus(row: RentMonth): string {
  switch (row.status.kind) {
    case 'paid':
      return m.rent_short_paid()
    case 'partly_paid':
      return m.rent_short_partly_paid()
    case 'late':
      return m.rent_short_late()
    case 'due':
    case 'nothing_to_pay':
      return statusText(row.status)
    case 'rent_not_set':
      return m.rent_short_rent_not_set()
  }
}

/** The line under a row's month. */
function rowDetail(row: RentMonth): string {
  const { status } = row
  switch (status.kind) {
    case 'paid':
      return m.rent_row_paid({
        amount: formatMoney(row.paid),
        date: formatDayMonth(status.on),
      })
    case 'partly_paid':
      return m.rent_row_partly_paid({
        paid: formatMoney(row.paid),
        expected: formatMoney(row.expected ?? 0),
        missing: formatMoney(status.missing),
      })
    case 'late':
      return m.rent_row_late({ date: formatDayMonth(row.dueDate) })
    case 'due':
      return m.rent_row_due({ date: formatDayMonth(row.dueDate) })
    case 'nothing_to_pay':
      return m.rent_row_nothing_to_pay({ amount: formatMoney(0) })
    case 'rent_not_set':
      return m.rent_row_rent_not_set()
  }
}

/** "Lokakuu 2026, marraskuu 2026" style list of months. */
export function monthList(rows: readonly RentMonth[]): string {
  return [...rows]
    .reverse()
    .map((row) =>
      formatMonth(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7))),
    )
    .join(', ')
}

export function RentPaymentsPage(props: Props) {
  const { view } = props
  const years = rentYears(view.tenancies, view.today)
  const currentYear = Number(view.today.slice(0, 4))
  const year = props.year ?? currentYear
  const data = {
    tenancies: view.tenancies,
    rentPeriods: view.rents,
    payments: view.payments,
    today: view.today,
  }
  const rows = rentMonths({
    ...data,
    from: `${String(year)}-01`,
    to: year === currentYear ? monthOf(view.today) : `${String(year)}-12`,
  })
  const received = view.payments
    .filter((p) => p.paidOn.startsWith(`${String(year)}-`))
    .reduce((sum, p) => sum + p.amount, 0)
  const unpaid = monthsNotFullyPaid(data).filter((row) =>
    row.month.startsWith(`${String(year)}-`),
  )
  const showTenant = new Set(rows.map((row) => row.tenancy.id)).size > 1

  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Box
        component="header"
        sx={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 44px',
          alignItems: 'center',
          px: 1.5,
          pt: 2,
          pb: 0.5,
        }}
      >
        <IconButton aria-label={m.amounts_back()} onClick={props.onBack}>
          <Icon path={BACK} />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 18 }}>
            {m.rent_payments_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.5, px: 2.5, pt: 1.25, pb: 3 }}
      >
        {years.length === 0 ? (
          <Typography
            sx={{
              ...card,
              px: 2.5,
              py: 3,
              textAlign: 'center',
              fontWeight: 800,
            }}
          >
            {m.rent_payments_empty()}
          </Typography>
        ) : (
          <>
            <Stack
              role="group"
              aria-label={m.rent_payments_year()}
              direction="row"
              sx={{ gap: 1, flexWrap: 'wrap' }}
            >
              {years.map((option) => {
                const pressed = option === year
                return (
                  <Button
                    key={option}
                    variant={pressed ? 'contained' : 'outlined'}
                    aria-pressed={pressed}
                    onClick={() => {
                      props.onYear(option)
                    }}
                    sx={{ borderRadius: 999, minHeight: 44, px: 2.25 }}
                  >
                    {String(option)}
                  </Button>
                )
              })}
            </Stack>
            <Stack
              component="section"
              aria-labelledby="received-title"
              sx={{ ...card, px: 2, py: 1.75, gap: 0.5 }}
            >
              <Typography
                id="received-title"
                component="h2"
                variant="body2"
                sx={{ fontWeight: 800, color: 'text.secondary' }}
              >
                {m.rent_payments_received({ year: String(year) })}
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 900 }}>
                {formatMoney(received)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m.rent_payments_received_note()}
              </Typography>
            </Stack>
            {unpaid.length > 0 ? (
              <Stack
                role="note"
                direction="row"
                sx={{
                  gap: 1.25,
                  alignItems: 'flex-start',
                  bgcolor: colors.yellowTint,
                  borderRadius: `${String(radii.tile)}px`,
                  px: 1.75,
                  py: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', flexShrink: 0, mt: 0.25 }}>
                  <Icon path={ALERT} size={20} />
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                  {m.rent_payments_unpaid({
                    count: unpaid.length,
                    months: monthList(unpaid),
                  })}
                </Typography>
              </Stack>
            ) : null}
            <Box
              component="ul"
              aria-label={m.rent_payments_months()}
              sx={{
                ...card,
                m: 0,
                p: 0,
                listStyle: 'none',
                overflow: 'hidden',
              }}
            >
              {rows.map((row, i) => (
                <Box
                  key={`${row.month}-${row.tenancy.id}`}
                  component="li"
                  sx={{
                    borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
                  }}
                >
                  <RowLink
                    to="/properties/$propertyId/rent/$tenancyId/$month"
                    params={{
                      propertyId: props.propertyId,
                      tenancyId: row.tenancy.id,
                      month: row.month,
                    }}
                    underline="none"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      minHeight: 60,
                      pl: 2,
                      pr: 1.5,
                      py: 0.75,
                      color: 'text.primary',
                    }}
                  >
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 900 }}>
                        {formatMonthName(row.month)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {showTenant
                          ? `${row.tenancy.tenantName} · ${rowDetail(row)}`
                          : rowDetail(row)}
                      </Typography>
                    </Stack>
                    <StatusChip status={row.status} text={shortStatus(row)} />
                    <Icon path={NEXT} size={18} />
                  </RowLink>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Stack>
    </Stack>
  )
}
