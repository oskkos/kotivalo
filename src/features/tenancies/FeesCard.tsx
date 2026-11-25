// A tenancy's fees on the Tenancy page (openspec: tenancies, "The tenancy
// page"): the fees not ended with their amount this month, the upcoming
// change and the per-occupant detail, the ended fees, that there are none,
// and the month's total the tenant pays. Owners get the add and change links
// from the route.
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import {
  isEnded,
  monthOf,
  periodOn,
  type Period,
} from '#/features/recurring-amounts/periods'
import { chargeName } from '#/lib/charge-labels'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { feeInMonth, occupantsInMonth, type FeeOfTenancy } from './fees'
import { rentInMonth } from './rent'

interface Props {
  tenancy: { validFrom: string }
  fees: readonly FeeOfTenancy[]
  occupants: readonly Period<number>[]
  rents: readonly Period<number>[]
  today: string
  /** Owners only: the link to add a fee. */
  add?: ReactNode
  /** Owners only: the link to change a fee. */
  change?: (fee: FeeOfTenancy) => ReactNode
}

export function FeesCard(props: Props) {
  const { tenancy, fees, occupants, today } = props
  // A tenancy that starts later shows its first month.
  const day = today < tenancy.validFrom ? tenancy.validFrom : today
  const month = monthOf(day)
  const persons = occupantsInMonth(occupants, tenancy, month) ?? 1
  const active = fees.filter((fee) => !isEnded(fee.amounts, day))
  const ended = fees.filter((fee) => isEnded(fee.amounts, day))
  const rent = rentInMonth(props.rents, tenancy, month)
  // The fees in effect this month, and the first amount of one that starts
  // later.
  const monthly = (fee: FeeOfTenancy) =>
    feeInMonth(fee, occupants, tenancy, month) ??
    (fee.amounts.at(0)?.value ?? 0) *
      (fee.basis === 'per_occupant' ? persons : 1)
  const total =
    rent === undefined
      ? undefined
      : rent +
        fees.reduce(
          (sum, fee) => sum + (feeInMonth(fee, occupants, tenancy, month) ?? 0),
          0,
        )
  return (
    <Stack
      component="section"
      aria-labelledby="fees-title"
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: `${String(radii.card)}px`,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', gap: 1.5, px: 2, pt: 1.75, pb: 1.25 }}
      >
        <Typography
          id="fees-title"
          component="h2"
          sx={{ flex: 1, fontSize: 15, fontWeight: 900 }}
        >
          {m.tenancy_fees_title()}
        </Typography>
        {props.add}
      </Stack>
      {fees.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, pb: 1.5 }}
        >
          {m.tenancy_fees_none()}
        </Typography>
      ) : null}
      {active.length > 0 ? (
        <Box
          component="ul"
          sx={{ listStyle: 'none', m: 0, px: 2, pb: 0.5 }}
          aria-label={m.tenancy_fees_title()}
        >
          {active.map((fee) => {
            const current = periodOn(fee.amounts, day)
            const shown = current ?? fee.amounts.at(0)
            const upcoming = fee.amounts.find(
              (p) => p.validFrom > day && p !== shown,
            )
            return (
              <Box
                component="li"
                key={fee.id}
                sx={{
                  py: 1,
                  '& + &': { borderTop: `1px solid ${colors.divider}` },
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }}>
                      {chargeName(fee)}
                    </Typography>
                    {fee.basis === 'per_occupant' && shown ? (
                      <Typography variant="body2" color="text.secondary">
                        {m.tenancy_fee_per_occupant({
                          amount: formatMoney(shown.value),
                          persons: String(persons),
                        })}
                      </Typography>
                    ) : null}
                    {shown ? (
                      <Typography variant="body2" color="text.secondary">
                        {m.amounts_from({ date: formatDate(shown.validFrom) })}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Typography sx={{ fontWeight: 900 }}>
                    {m.amounts_per_month({ amount: formatMoney(monthly(fee)) })}
                  </Typography>
                  {props.change?.(fee)}
                </Stack>
                {upcoming ? (
                  <Box
                    sx={{
                      mt: 0.75,
                      bgcolor: colors.yellowTint,
                      borderRadius: `${String(radii.input)}px`,
                      px: 1.5,
                      py: 0.75,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {m.amounts_upcoming({
                      date: formatDate(upcoming.validFrom),
                      amount: m.amounts_per_month({
                        amount: formatMoney(upcoming.value),
                      }),
                    })}
                  </Box>
                ) : null}
              </Box>
            )
          })}
        </Box>
      ) : null}
      {ended.length > 0 ? (
        <Box
          sx={{
            borderTop: `1px solid ${colors.cardBorder}`,
            bgcolor: 'background.default',
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {m.tenancy_fees_ended_title()}
          </Typography>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {ended.map((fee) => {
              const last = fee.amounts.at(-2)
              return (
                <Box
                  component="li"
                  key={fee.id}
                  sx={{
                    py: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>
                      {chargeName(fee)}
                    </Typography>
                    {last?.validTo ? (
                      <Typography variant="body2" color="text.secondary">
                        {m.amounts_charge_ended({
                          date: formatDate(last.validTo),
                          amount: m.amounts_per_month({
                            amount: formatMoney(last.value),
                          }),
                        })}
                      </Typography>
                    ) : null}
                  </Stack>
                  {props.change?.(fee)}
                </Box>
              )
            })}
          </Box>
        </Box>
      ) : null}
      {total !== undefined ? (
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            gap: 1.5,
            px: 2,
            py: 1.25,
            borderTop: `1px solid ${colors.cardBorder}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {m.tenancy_fees_total()}
          </Typography>
          <Typography sx={{ fontWeight: 900 }}>{formatMoney(total)}</Typography>
        </Stack>
      ) : null}
    </Stack>
  )
}
