// A flat's usage charges page, *Käyttömaksut* (Design canvas: Käyttömaksut;
// openspec: usage-charges, "The usage charges page"): the charges not ended
// with their amount today, the per-occupant detail, the start and the next
// change, the ended ones apart, or that there are none. Owners get the add
// and change links from the route.
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { isEnded, periodOn } from '#/features/recurring-amounts/periods'
import { chargeName } from '#/lib/charge-labels'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { occupantsOn, type UsageChargePeriods } from './months'
import type { UsageChargesView } from './usage-charges.server'

interface Props {
  view: Pick<UsageChargesView, 'role' | 'today' | 'charges' | 'tenancies'>
  address: string
  onBack: () => void
  /** Owners only: the link to add a usage charge. */
  add?: ReactNode
  /** Owners only: the link to change a usage charge. */
  change?: (charge: UsageChargePeriods) => ReactNode
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

/** "22,00 €/asukas/kk · 2 asukasta", or the amount per month. */
export function perUnitText(
  charge: Pick<UsageChargePeriods, 'basis'>,
  amount: number,
  persons: number,
): string {
  return charge.basis === 'per_occupant'
    ? m.usage_charge_per_occupant_detail({
        amount: formatMoney(amount),
        occupants: m.occupants_count({ persons }),
      })
    : m.amounts_per_month({ amount: formatMoney(amount) })
}

/** An upcoming amount: per occupant per month, or per month. */
export function unitAmount(
  charge: Pick<UsageChargePeriods, 'basis'>,
  amount: number,
): string {
  return charge.basis === 'per_occupant'
    ? m.usage_charge_per_occupant_amount({ amount: formatMoney(amount) })
    : m.amounts_per_month({ amount: formatMoney(amount) })
}

export function UsageChargesPage(props: Props) {
  const { view } = props
  const owner = view.role === 'owner'
  // This month's occupants: those on its first day, as the charges count.
  const persons = occupantsOn(view.tenancies, `${view.today.slice(0, 7)}-01`)
  const active = view.charges.filter((c) => !isEnded(c.periods, view.today))
  const ended = view.charges.filter((c) => isEnded(c.periods, view.today))
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
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5 L8 12 L15 19" />
          </svg>
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 18 }}>
            {m.usage_charges_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack component="main" sx={{ gap: 1.75, px: 2.5, pt: 1.25, pb: 3 }}>
        {view.charges.length === 0 ? (
          <Typography sx={{ ...card, px: 2, py: 1.75, fontWeight: 800 }}>
            {m.usage_charges_none()}
          </Typography>
        ) : null}
        {active.length > 0 ? (
          <Box
            component="ul"
            aria-label={m.usage_charges_title()}
            sx={{ ...card, listStyle: 'none', m: 0, px: 2, py: 0 }}
          >
            {active.map((charge) => {
              const current = periodOn(charge.periods, view.today)
              const shown = current ?? charge.periods.at(0)
              const upcoming = charge.periods.find(
                (p) => p.validFrom > view.today && p !== shown,
              )
              const per = charge.basis === 'per_occupant' ? persons : 1
              return (
                <Box
                  component="li"
                  key={charge.id}
                  sx={{
                    py: 1.25,
                    '& + &': { borderTop: `1px solid ${colors.divider}` },
                  }}
                >
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'center', gap: 1.5 }}
                  >
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900 }}>
                        {chargeName(charge)}
                      </Typography>
                      {shown && charge.basis === 'per_occupant' ? (
                        <Typography variant="body2" color="text.secondary">
                          {perUnitText(charge, shown.value, persons)}
                        </Typography>
                      ) : null}
                      {shown ? (
                        <Typography variant="body2" color="text.secondary">
                          {m.amounts_from({
                            date: formatDate(shown.validFrom),
                          })}
                        </Typography>
                      ) : null}
                    </Stack>
                    {shown ? (
                      <Typography sx={{ fontWeight: 900 }}>
                        {m.amounts_per_month({
                          amount: formatMoney(shown.value * per),
                        })}
                      </Typography>
                    ) : null}
                    {owner ? props.change?.(charge) : null}
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
                        amount: unitAmount(charge, upcoming.value),
                      })}
                    </Box>
                  ) : null}
                </Box>
              )
            })}
          </Box>
        ) : null}
        {ended.length > 0 ? (
          <Stack
            component="section"
            aria-labelledby="ended-usage-charges"
            sx={{ gap: 0.75 }}
          >
            <Typography
              id="ended-usage-charges"
              component="h2"
              sx={{ fontSize: 15, fontWeight: 900 }}
            >
              {m.usage_charges_ended_title()}
            </Typography>
            <Box
              component="ul"
              sx={{ ...card, listStyle: 'none', m: 0, px: 2, py: 0 }}
            >
              {ended.map((charge) => {
                const last = charge.periods.at(-2)
                return (
                  <Stack
                    component="li"
                    key={charge.id}
                    direction="row"
                    sx={{ alignItems: 'center', gap: 1.5, minHeight: 56 }}
                  >
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800 }}>
                        {chargeName(charge)}
                      </Typography>
                      {last?.validTo ? (
                        <Typography variant="body2" color="text.secondary">
                          {m.amounts_charge_ended({
                            date: formatDate(last.validTo),
                            amount: unitAmount(charge, last.value),
                          })}
                        </Typography>
                      ) : null}
                    </Stack>
                    {owner ? props.change?.(charge) : null}
                  </Stack>
                )
              })}
            </Box>
          </Stack>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {m.usage_charges_occupants_note()}
        </Typography>
        {owner ? props.add : null}
      </Stack>
    </Stack>
  )
}
