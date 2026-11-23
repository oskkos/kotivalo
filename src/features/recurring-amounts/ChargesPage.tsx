// A flat's charges by year (Design canvas: Vastikkeet kuukausittain;
// openspec: recurring-amounts, "The charges page"): the year's total, the
// maintenance charge and the financing charge by treatment, and the months
// newest first. Computed from the periods; nothing here is stored.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { YearChoice } from '#/components/YearChoice'
import { formatMoney, formatMonthName } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { FinancingTreatment, PropertyRole } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import {
  CHARGE_KINDS,
  chargesOfYear,
  chargeYears,
  type ChargeMonth,
  type ChargePeriods,
  type TreatmentKey,
} from './charges'
import { kindLabel, treatmentLabel } from './labels'
import type { Period } from './periods'

export interface ChargesPageView {
  role: PropertyRole
  today: string
  amounts: ChargePeriods
  treatments: Period<FinancingTreatment>[]
}

interface Props {
  view: ChargesPageView
  propertyId: string
  address: string
  /** The year shown; the current year when not chosen or not offered. */
  year: number | undefined
  onBack: () => void
  onYear: (year: number) => void
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

const TextLink = createLink(Link)
const ButtonLink = createLink(Button)

const TREATMENTS: TreatmentKey[] = [
  'income_recognised',
  'capitalised',
  'not_set',
]

function treatmentText(key: TreatmentKey): string {
  return key === 'not_set'
    ? m.charges_treatment_not_set()
    : treatmentLabel[key]()
}

function BackIcon() {
  return (
    <svg
      width={24}
      height={24}
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
  )
}

/** "Hoitovastike 214,00 € · Rahoitusvastike 86,00 €" */
function monthDetail(row: ChargeMonth): string {
  return CHARGE_KINDS.flatMap((kind) => {
    const charge = row.charges[kind]
    return charge
      ? [
          m.charges_month_charge({
            charge: kindLabel[kind](),
            amount: formatMoney(charge.cents),
          }),
        ]
      : []
  }).join(' · ')
}

function SummaryRow(props: { label: string; note?: string; amount: number }) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 44,
        py: 0.5,
        borderTop: `1px solid ${colors.divider}`,
      }}
    >
      <Typography
        component="dt"
        sx={{ fontSize: 14, fontWeight: 800, color: 'text.secondary' }}
      >
        {props.label}
        {props.note ? (
          <Box
            component="span"
            sx={{ display: 'block', fontSize: 12, fontWeight: 700 }}
          >
            {props.note}
          </Box>
        ) : null}
      </Typography>
      <Typography component="dd" sx={{ m: 0, fontSize: 15, fontWeight: 900 }}>
        {formatMoney(props.amount)}
      </Typography>
    </Stack>
  )
}

export function ChargesPage(props: Props) {
  const { view } = props
  const years = chargeYears(view.amounts, view.today)
  const currentYear = Number(view.today.slice(0, 4))
  const year =
    props.year !== undefined && years.includes(props.year)
      ? props.year
      : currentYear
  const charges = chargesOfYear(view.amounts, view.treatments, year, view.today)

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
          <BackIcon />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 18 }}>
            {m.charges_title()}
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
            aria-labelledby="charges-empty-title"
            sx={{ ...card, px: 2, py: 2.5, gap: 1, alignItems: 'flex-start' }}
          >
            <Typography
              id="charges-empty-title"
              component="h2"
              sx={{ fontSize: 17, fontWeight: 900 }}
            >
              {m.charges_empty_title()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {m.charges_empty_text()}
            </Typography>
            {view.role === 'owner' ? (
              <ButtonLink
                to="/properties/$propertyId/amounts"
                params={{ propertyId: props.propertyId }}
                variant="contained"
                sx={{ mt: 0.5, borderRadius: 999 }}
              >
                {m.charges_empty_set()}
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
              aria-labelledby="charges-total-title"
              sx={{ ...card, px: 2, py: 1.75, gap: 0.5 }}
            >
              <Typography
                id="charges-total-title"
                component="h2"
                variant="body2"
                sx={{ fontWeight: 800, color: 'text.secondary' }}
              >
                {m.charges_year_total({ year: String(year) })}
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 900 }}>
                {formatMoney(charges.total)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m.charges_months_counted({ count: charges.months.length })}
                {charges.estimate === undefined
                  ? null
                  : ` · ${m.charges_estimate({ amount: formatMoney(charges.estimate) })}`}
              </Typography>
              <Box component="dl" sx={{ m: 0, mt: 1 }}>
                {charges.months.some(
                  (row) => row.charges.maintenance_charge,
                ) ? (
                  <SummaryRow
                    label={kindLabel.maintenance_charge()}
                    amount={charges.maintenance}
                  />
                ) : null}
                {TREATMENTS.map((key) => {
                  const amount = charges.financing[key]
                  return amount === undefined ? null : (
                    <SummaryRow
                      key={key}
                      label={kindLabel.financing_charge()}
                      note={treatmentText(key)}
                      amount={amount}
                    />
                  )
                })}
              </Box>
            </Stack>
            {charges.months.length > 0 ? (
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
                {charges.months.map((row, i) => (
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
                        {monthDetail(row)}
                      </Typography>
                      {CHARGE_KINDS.map((kind) => {
                        const previous = row.charges[kind]?.previous
                        return previous === undefined ? null : (
                          <Typography
                            key={kind}
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
                              charge: kindLabel[kind](),
                              amount: formatMoney(previous),
                            })}
                          </Typography>
                        )
                      })}
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
              {m.charges_footnote()}{' '}
              <TextLink
                to="/properties/$propertyId/amounts"
                params={{ propertyId: props.propertyId }}
                sx={{ fontWeight: 800 }}
              >
                {m.amounts_title()}
              </TextLink>
            </Typography>
          </>
        )}
      </Stack>
    </Stack>
  )
}
