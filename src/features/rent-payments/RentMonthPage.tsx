// A month's rent payments for a tenancy (Design canvas: Kuukauden vuokra ·
// maksut; openspec: rent-payments, "The month's rent payments page"): the
// status, expected, paid and missing amounts, and the payments. Owners add
// and delete payments.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { Tenancy } from '#/features/tenancies/tenancy.repository.server'
import { valueInTenancyMonth } from '#/features/tenancies/rent'
import { chargeName } from '#/lib/charge-labels'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { DeletePaymentDialog } from './DeletePaymentDialog'
import { dueText, rentMonthTitle } from './labels'
import { RecordPaymentDialog } from './RecordPaymentDialog'
import type { RentPayment } from './rent-payment.repository.server'
import {
  rentMonth,
  type FeesByTenancy,
  type OccupantsByTenancy,
  type RentsByTenancy,
} from './status'
import { StatusChip } from './StatusChip'

export interface RentMonthView {
  role: 'owner' | 'member'
  today: string
  tenancy: Tenancy
  month: string
  rents: RentsByTenancy
  occupants: OccupantsByTenancy
  fees: FeesByTenancy
  /** The month's payments of the tenancy. */
  payments: RentPayment[]
}

interface Props {
  view: RentMonthView
  propertyId: string
  address: string
  /** Where Back leads: the flat, or the rent payments page it came from. */
  backTo?: 'flat' | 'payments'
  onBack: () => void
  /** After a payment was recorded or deleted: reload. */
  onChanged: () => Promise<void>
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

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
const TRASH = 'M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7'
const CHECK = 'M5 12 L10 17 L19 7'
const PLUS = 'M12 5 V19 M5 12 H19'

/** A bar of how much of the rent is paid; hidden from assistive tech. */
export function PaidBar(props: { paid: number; expected: number }) {
  const share = Math.min(1, props.paid / Math.max(1, props.expected))
  return (
    <Box
      aria-hidden="true"
      sx={{
        height: 8,
        borderRadius: 4,
        bgcolor: colors.divider,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          width: `${String(Math.round(share * 100))}%`,
          height: 8,
          borderRadius: 4,
          bgcolor: 'primary.main',
        }}
      />
    </Box>
  )
}

export function RentMonthPage(props: Props) {
  const { view } = props
  const owner = view.role === 'owner'
  const row = rentMonth(view.tenancy, view.month, {
    rents: view.rents,
    occupants: view.occupants,
    fees: view.fees,
    payments: view.payments,
    today: view.today,
  })
  const [recording, setRecording] = useState(false)
  const [deleting, setDeleting] = useState<RentPayment>()
  // A per-occupant fee's amount per occupant in the month.
  const perOccupant = (feeId: string) => {
    const fee = view.fees[view.tenancy.id]?.find((f) => f.id === feeId)
    return fee
      ? (valueInTenancyMonth(fee.amounts, view.tenancy, view.month) ?? 0)
      : 0
  }

  const amounts: [string, string][] = [
    [
      m.rent_month_expected(),
      row.expected === undefined ? '–' : formatMoney(row.expected),
    ],
    [m.rent_month_paid(), formatMoney(row.paid)],
    [
      m.rent_month_missing(),
      row.missing === undefined ? '–' : formatMoney(row.missing),
    ],
  ]

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
        <IconButton
          aria-label={
            props.backTo === 'payments'
              ? m.rent_month_back_to_payments()
              : m.amounts_back()
          }
          onClick={props.onBack}
        >
          <Icon path={BACK} />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 18 }}>
            {rentMonthTitle(view.month)}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {`${props.address} · ${view.tenancy.tenantName}`}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 1.25, pb: 3 }}
      >
        <Stack
          component="section"
          aria-label={m.rent_month_summary()}
          sx={{ ...card, borderRadius: '22px', p: 2, gap: 1.5 }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.25,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 800, color: 'text.secondary' }}
            >
              {dueText(row.dueDate)}
            </Typography>
            <StatusChip status={row.status} />
          </Stack>
          {row.status.kind === 'partly_paid' && row.expected !== undefined ? (
            <PaidBar paid={row.paid} expected={row.expected} />
          ) : null}
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {amounts.map(([label, value]) => (
              <Stack key={label} sx={{ gap: 0.25 }}>
                <Typography
                  component="dt"
                  sx={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'text.secondary',
                  }}
                >
                  {label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{ m: 0, fontSize: 18, fontWeight: 900 }}
                >
                  {value}
                </Typography>
              </Stack>
            ))}
          </Box>
          {row.parts.length > 1 ? (
            <Box
              component="ul"
              aria-label={m.rent_month_breakdown()}
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                borderTop: `1px solid ${colors.divider}`,
              }}
            >
              {row.parts.map((part) => (
                <Stack
                  component="li"
                  key={part.type === 'rent' ? 'rent' : part.feeId}
                  direction="row"
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 1,
                    minHeight: 40,
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                    {part.type === 'rent'
                      ? m.rent_month_breakdown_rent()
                      : chargeName(part)}
                    {part.type === 'fee' && part.persons !== null ? (
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                      >
                        {` · ${m.rent_month_breakdown_per_occupant({
                          persons: String(part.persons),
                          amount: formatMoney(perOccupant(part.feeId)),
                        })}`}
                      </Typography>
                    ) : null}
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 900 }}>
                    {formatMoney(part.amount)}
                  </Typography>
                </Stack>
              ))}
              <Box component="li" sx={{ pt: 0.5 }}>
                <Link
                  href={`/properties/${props.propertyId}/tenancy`}
                  sx={{ fontSize: 14, fontWeight: 800 }}
                >
                  {m.rent_month_breakdown_link()}
                </Link>
              </Box>
            </Box>
          ) : null}
        </Stack>
        <Stack
          component="section"
          aria-labelledby="payments-title"
          sx={{ gap: 0.75 }}
        >
          <Typography
            id="payments-title"
            variant="h3"
            component="h2"
            sx={{ fontSize: 15, mt: 0.5 }}
          >
            {m.rent_month_payments()}
          </Typography>
          {view.payments.length === 0 ? (
            <Typography
              sx={{ ...card, px: 2, py: 1.75, fontSize: 14, fontWeight: 800 }}
            >
              {m.rent_month_no_payments()}
            </Typography>
          ) : (
            <Box
              component="ul"
              sx={{
                ...card,
                m: 0,
                p: 0,
                listStyle: 'none',
                overflow: 'hidden',
              }}
            >
              {view.payments.map((payment, i) => (
                <Stack
                  key={payment.id}
                  component="li"
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    gap: 1.5,
                    minHeight: 64,
                    pl: 1.75,
                    pr: owner ? 0.75 : 1.75,
                    py: 0.75,
                    borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: '19px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: colors.greenTint,
                    }}
                  >
                    <Icon path={CHECK} size={18} />
                  </Box>
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 900 }}>
                      {formatMoney(payment.amount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {m.rent_month_payment_detail({
                        date: formatDate(payment.paidOn),
                        name: payment.recordedBy,
                      })}
                    </Typography>
                  </Stack>
                  {owner ? (
                    <IconButton
                      aria-label={m.rent_month_delete_label({
                        amount: formatMoney(payment.amount),
                        date: formatDate(payment.paidOn),
                      })}
                      onClick={() => {
                        setDeleting(payment)
                      }}
                    >
                      <Icon path={TRASH} size={20} />
                    </IconButton>
                  ) : null}
                </Stack>
              ))}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            {owner ? m.rent_month_note() : m.rent_month_member_note()}
          </Typography>
        </Stack>
      </Stack>
      {owner ? (
        <Box
          component="footer"
          sx={{
            px: 2.5,
            pt: 1.5,
            pb: 3.5,
            borderTop: `1px solid ${colors.cardBorder}`,
          }}
        >
          <Button
            fullWidth
            startIcon={<Icon path={PLUS} size={20} />}
            onClick={() => {
              setRecording(true)
            }}
            sx={{ minHeight: 56, fontSize: 17 }}
          >
            {m.rent_payment_add()}
          </Button>
        </Box>
      ) : null}
      {recording ? (
        <RecordPaymentDialog
          propertyId={props.propertyId}
          tenancy={view.tenancy}
          month={view.month}
          missing={row.missing}
          withFees={row.parts.length > 1}
          today={view.today}
          open
          onClose={() => {
            setRecording(false)
          }}
          onDone={async () => {
            setRecording(false)
            await props.onChanged()
          }}
        />
      ) : null}
      {deleting ? (
        <DeletePaymentDialog
          propertyId={props.propertyId}
          payment={deleting}
          onClose={() => {
            setDeleting(undefined)
          }}
          onDone={async () => {
            setDeleting(undefined)
            await props.onChanged()
          }}
        />
      ) : null}
    </Stack>
  )
}
