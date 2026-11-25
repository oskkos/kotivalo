// A flat's usage charges month by month, *Käyttömaksut kuukausittain*
// (Design canvas: Käyttömaksut kuukausittain; openspec: usage-charges, "The
// usage charges by month page"): one year at a time, the year's total and
// each charge's sum, and the months newest first with each charge, the
// per-occupant detail and the previous amount of a changed one.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { YearChoice } from '#/components/YearChoice'
import { chargeName } from '#/lib/charge-labels'
import { formatMoney, formatMonthName } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { PropertyRole } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import {
  usageChargeYears,
  usageChargesOfYear,
  type MonthUsageCharge,
  type OccupiedTenancy,
  type UsageChargePeriods,
} from './months'

const TextLink = createLink(Link)
const ButtonLink = createLink(Button)

interface Props {
  view: {
    role: PropertyRole
    today: string
    charges: readonly UsageChargePeriods[]
    tenancies: readonly OccupiedTenancy[]
  }
  propertyId: string
  address: string
  /** The year asked for; the current year otherwise. */
  year?: number
  onBack: () => void
  onYear: (year: number) => void
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

/** "Vesimaksu 2 × 22,00 €", or the charge's name and amount. */
function chargeLine(charge: MonthUsageCharge): string {
  return charge.persons === null
    ? `${chargeName(charge)} ${formatMoney(charge.cents)}`
    : `${chargeName(charge)} ${m.rent_month_breakdown_per_occupant({
        persons: String(charge.persons),
        amount: formatMoney(charge.perUnit),
      })}`
}

export function UsageChargesByMonthPage(props: Props) {
  const { view } = props
  const years = usageChargeYears(view.charges, view.today)
  const currentYear = Number(view.today.slice(0, 4))
  const year =
    props.year !== undefined && years.includes(props.year)
      ? props.year
      : currentYear
  const data = usageChargesOfYear(
    view.charges,
    view.tenancies,
    year,
    view.today,
  )
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
            {m.usage_charges_months_title()}
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
          <Stack
            component="section"
            aria-labelledby="usage-months-empty"
            sx={{ ...card, px: 2, py: 2.5, gap: 1, alignItems: 'flex-start' }}
          >
            <Typography
              id="usage-months-empty"
              component="h2"
              sx={{ fontSize: 17, fontWeight: 900 }}
            >
              {m.usage_charges_none()}
            </Typography>
            {view.role === 'owner' ? (
              <ButtonLink
                to="/properties/$propertyId/usage-charges"
                params={{ propertyId: props.propertyId }}
                variant="contained"
                sx={{ mt: 0.5, borderRadius: 999 }}
              >
                {m.usage_charges_months_empty_set()}
              </ButtonLink>
            ) : null}
          </Stack>
        ) : (
          <>
            <YearChoice
              label={m.charges_year()}
              years={years}
              year={year}
              onYear={props.onYear}
            />
            <Stack
              component="section"
              aria-labelledby="usage-total-title"
              sx={{ ...card, px: 2, py: 1.75, gap: 0.5 }}
            >
              <Typography
                id="usage-total-title"
                component="h2"
                variant="body2"
                sx={{ fontWeight: 800, color: 'text.secondary' }}
              >
                {m.usage_charges_months_year_total({ year: String(year) })}
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 900 }}>
                {formatMoney(data.total)}
              </Typography>
              {year === currentYear ? (
                <Typography variant="body2" color="text.secondary">
                  {m.charges_months_counted({ count: data.months.length })}
                </Typography>
              ) : null}
              <Box component="dl" sx={{ m: 0, mt: 1 }}>
                {data.sums.map((sum) => (
                  <Stack
                    key={sum.id}
                    direction="row"
                    sx={{ justifyContent: 'space-between', minHeight: 32 }}
                  >
                    <Typography component="dt" sx={{ fontWeight: 800 }}>
                      {chargeName(sum)}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, fontWeight: 900 }}>
                      {formatMoney(sum.cents)}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            </Stack>
            {data.months.length > 0 ? (
              <Box
                component="ul"
                aria-label={m.charges_months()}
                sx={{
                  ...card,
                  m: 0,
                  p: 0,
                  listStyle: 'none',
                  overflow: 'hidden',
                }}
              >
                {data.months.map((row, i) => (
                  <Stack
                    key={row.month}
                    component="li"
                    direction="row"
                    sx={{
                      alignItems: 'center',
                      gap: 1.5,
                      minHeight: 60,
                      px: 2,
                      py: 1,
                      borderTop:
                        i === 0 ? 'none' : `1px solid ${colors.divider}`,
                    }}
                  >
                    <Stack
                      sx={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}
                    >
                      <Typography sx={{ fontSize: 15, fontWeight: 900 }}>
                        {formatMonthName(row.month)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {row.charges.map(chargeLine).join(' · ')}
                      </Typography>
                      {row.charges.flatMap((charge) =>
                        charge.previous === undefined
                          ? []
                          : [
                              <Typography
                                key={charge.id}
                                sx={{
                                  mt: 0.375,
                                  px: 1,
                                  borderRadius: 999,
                                  bgcolor: colors.lavenderTint,
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {m.charges_changed({
                                  charge: chargeName(charge),
                                  amount: formatMoney(charge.previous),
                                })}
                              </Typography>,
                            ],
                      )}
                    </Stack>
                    <Typography
                      sx={{
                        fontSize: 16,
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatMoney(row.total)}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              {m.usage_charges_months_footnote()}{' '}
              <TextLink
                to="/properties/$propertyId/usage-charges"
                params={{ propertyId: props.propertyId }}
                sx={{ fontWeight: 800 }}
              >
                {m.usage_charges_title()}
              </TextLink>
            </Typography>
          </>
        )}
      </Stack>
    </Stack>
  )
}
