// The year summary (Design canvas: VerotAsunnot, VerotEiOsuutta; openspec:
// year-summary, "The year summary page"): one year at a time, a card per flat
// with row 2.1, rows 2.2–2.5 summed and the checks as chips, all for the
// user's own share. The figures are computed on the server; nothing here is
// stored.
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { sortByStreetAddress } from '#/features/properties/property'
import {
  formatDayMonth,
  formatMoney,
  formatMonthName,
  formatShare,
  INTL_LOCALES,
} from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { colors, radii } from '#/theme/tokens'
import type { Check } from './summary'
import type { FlatCard, YearSummaryView } from './view'

interface Props {
  view: YearSummaryView
  onYear: (year: number) => void
  bottomNav: React.ReactNode
}

function Chevron(props: { back?: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={props.back ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'} />
    </svg>
  )
}

/** "Tammikuu–marraskuu" for the current year; nothing for a past year. */
export function monthsSoFar(year: number, today: string): string | null {
  const current = today.slice(0, 7)
  if (Number(today.slice(0, 4)) !== year) {
    return null
  }
  const from = formatMonthName(`${String(year)}-01`)
  if (current.endsWith('-01')) {
    return from
  }
  const to = formatMonthName(current)
  return m.year_summary_months_so_far({
    from,
    to:
      getLocale() === 'en'
        ? to
        : to.toLocaleLowerCase(INTL_LOCALES[getLocale()]),
  })
}

function companyLine(card: FlatCard): string {
  const { housingCompanyName: name, businessId } = card
  if (name && businessId) {
    return m.year_summary_company({ name, businessId })
  }
  if (name) {
    return m.year_summary_company_no_business_id({ name })
  }
  if (businessId) {
    return m.year_summary_company_no_name({ businessId })
  }
  return m.year_summary_company_missing()
}

/** A check as a chip's text. */
export function chipText(check: Check): string {
  switch (check.kind) {
    case 'unpaid':
      return m.year_summary_chip_unpaid({ count: check.months.length })
    case 'partly_paid':
      return m.year_summary_chip_partly_paid({ count: check.months.length })
    case 'vacant':
      return m.year_summary_chip_vacant({ count: check.months.length })
    case 'details_missing':
      return m.year_summary_chip_details_missing()
    case 'treatment_not_set':
      return m.year_summary_chip_treatment_not_set()
    case 'share_changed':
      return m.year_summary_chip_share_changed({
        date: formatDayMonth(check.on),
      })
  }
}

function CheckChip({ check }: { check: Check }) {
  // Missing details are a gap to fill in, not a figure to look at.
  const dashed = check.kind === 'details_missing'
  return (
    <Box
      component="li"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: `${String(radii.pill)}px`,
        px: 1.25,
        py: dashed ? 0.25 : 0.375,
        fontSize: 12,
        fontWeight: 800,
        ...(dashed
          ? { border: `1.5px dashed ${colors.dashed}` }
          : { bgcolor: colors.plum, color: colors.cream }),
      }}
    >
      {dashed ? null : (
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 7 V13 M12 17 V17.01" />
        </svg>
      )}
      {chipText(check)}
    </Box>
  )
}

function Figure(props: { label: string; amount: number }) {
  return (
    <Stack
      sx={{
        bgcolor: 'background.default',
        borderRadius: '12px',
        px: 1.5,
        py: 1,
      }}
    >
      <Typography
        component="span"
        sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}
      >
        {props.label}
      </Typography>
      <Typography component="span" sx={{ fontSize: 16, fontWeight: 900 }}>
        {formatMoney(props.amount)}
      </Typography>
    </Stack>
  )
}

const CardLink = createLink(ButtonBase)

function Card(props: { card: FlatCard; year: number }) {
  const { card } = props
  const missing = card.housingCompanyName === null && card.businessId === null
  return (
    <CardLink
      to="/year-summary/$propertyId"
      params={{ propertyId: card.propertyId }}
      search={{ year: props.year }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        gap: 1.25,
        bgcolor: 'background.paper',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: `${String(radii.card)}px`,
        px: 2,
        py: 1.75,
        fontFamily: 'inherit',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1 }}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: 16, fontWeight: 900 }}>
            {card.streetAddress}
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: 'text.secondary',
              fontStyle: missing ? 'italic' : 'normal',
            }}
          >
            {companyLine(card)}
          </Typography>
          <Typography
            component="span"
            sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}
          >
            {m.year_summary_share({ share: formatShare(card.share) })}
          </Typography>
        </Stack>
        <Box sx={{ color: 'text.secondary', display: 'flex', pt: 0.25 }}>
          <Chevron />
        </Box>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Figure label={m.year_summary_income()} amount={card.income} />
        <Figure label={m.year_summary_costs()} amount={card.costs} />
      </Box>
      {card.checks.length > 0 ? (
        <Box
          component="ul"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            m: 0,
            p: 0,
            listStyle: 'none',
          }}
        >
          {card.checks.map((check) => (
            <CheckChip key={check.kind} check={check} />
          ))}
        </Box>
      ) : null}
    </CardLink>
  )
}

const list = (items: readonly string[]) =>
  new Intl.ListFormat(INTL_LOCALES[getLocale()], {
    type: 'conjunction',
  }).format(items)

export function YearSummaryPage(props: Props) {
  const { view } = props
  const flats = sortByStreetAddress(view.flats, getLocale())
  const notIncluded = sortByStreetAddress(view.notIncluded, getLocale())
  const first = view.years.at(0)
  const last = view.years.at(-1)
  const year = String(view.year)
  const months = monthsSoFar(view.year, view.today)

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
          pb: 0.25,
        }}
      >
        <IconButton
          aria-label={m.year_summary_previous_year()}
          disabled={first === undefined || view.year <= first}
          onClick={() => {
            props.onYear(view.year - 1)
          }}
        >
          <Chevron back />
        </IconButton>
        <Stack sx={{ alignItems: 'center' }}>
          <Typography
            component="span"
            sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}
          >
            {m.year_summary_kicker()}
          </Typography>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: 22, letterSpacing: '-0.02em' }}
          >
            {year}
          </Typography>
          {months ? (
            <Typography
              component="span"
              sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}
            >
              {months}
            </Typography>
          ) : null}
        </Stack>
        <IconButton
          aria-label={m.year_summary_next_year()}
          disabled={last === undefined || view.year >= last}
          onClick={() => {
            props.onYear(view.year + 1)
          }}
        >
          <Chevron />
        </IconButton>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.5, px: 2.5, pt: 0.75, pb: 2 }}
      >
        {flats.length === 0 ? (
          <Stack
            component="section"
            aria-labelledby="year-summary-empty-title"
            sx={{
              bgcolor: 'background.paper',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '24px',
              px: 2.75,
              py: 3.5,
              mt: 5,
              gap: 1.25,
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <Typography
              id="year-summary-empty-title"
              component="h2"
              sx={{ fontSize: 19, fontWeight: 900 }}
            >
              {m.year_summary_empty_title({ year })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {m.year_summary_empty_text()}
              {notIncluded.length > 0
                ? ` ${m.year_summary_empty_seen({ count: notIncluded.length, year })}`
                : null}
            </Typography>
          </Stack>
        ) : (
          <>
            <Stack
              component="section"
              sx={{
                bgcolor: colors.plum,
                color: colors.cream,
                borderRadius: '24px',
                px: 2.5,
                py: 2,
                gap: 0.5,
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: colors.onPlumMuted,
                }}
              >
                {m.year_summary_intro_title({ count: flats.length })}
              </Typography>
              <Typography
                component="span"
                sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.35 }}
              >
                {m.year_summary_intro()}
              </Typography>
            </Stack>
            <Stack
              component="section"
              aria-label={m.properties_title()}
              sx={{ gap: 1.25 }}
            >
              {flats.map((card) => (
                <Card key={card.propertyId} card={card} year={view.year} />
              ))}
            </Stack>
            <Stack
              component="section"
              direction="row"
              sx={{
                gap: 1.25,
                alignItems: 'flex-start',
                bgcolor: colors.lavenderTint,
                borderRadius: `${String(radii.tile)}px`,
                px: 1.75,
                py: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', pt: 0.125 }}>
                <svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11 V16 M12 8 V8.01" />
                </svg>
              </Box>
              <Stack
                sx={{
                  gap: 0.5,
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                {notIncluded.length > 0 ? (
                  <Typography component="p" sx={{ font: 'inherit' }}>
                    {m.year_summary_not_included({
                      count: notIncluded.length,
                      flats: list(notIncluded.map((f) => f.streetAddress)),
                      year,
                    })}
                  </Typography>
                ) : null}
                <Typography component="p" sx={{ font: 'inherit' }}>
                  {m.year_summary_not_counted()}
                </Typography>
              </Stack>
            </Stack>
          </>
        )}
      </Stack>
      {props.bottomNav}
    </Stack>
  )
}
