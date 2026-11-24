// The tenancy card on a flat's details page (Design canvas: Asunnon tiedot
// · vuokra vuokrasuhteella): the current tenant with the contract type,
// start and due day, and the rent with its next change when given; it opens
// the Tenancy page (openspec: properties, "The flat details page").
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { periodOn, type Period } from '#/features/recurring-amounts/periods'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { contractShortLabel } from './labels'
import { initials } from './TenancyPage'
import type { Tenancy } from './tenancy.repository.server'

const CardLink = createLink(Link)

export function TenancyCard(props: {
  propertyId: string
  /** The current tenancy, or null when the flat is vacant. */
  tenancy: Tenancy | null
  /** Adds the due day, as the flat details page shows it. */
  showDueDay?: boolean
  /** The tenancy's rent periods, oldest first, to show the rent. */
  rents?: readonly Period<number>[]
  /** Today, for the rent in effect. */
  today?: string
}) {
  const { tenancy, rents, today } = props
  // The rent today, or the first rent of a tenancy that starts later.
  const day =
    tenancy && today !== undefined
      ? today < tenancy.validFrom
        ? tenancy.validFrom
        : today
      : undefined
  const rent = rents && day !== undefined ? periodOn(rents, day) : undefined
  const next =
    rents && day !== undefined
      ? rents.find((p) => p.validFrom > day)
      : undefined
  return (
    <CardLink
      to="/properties/$propertyId/tenancy"
      params={{ propertyId: props.propertyId }}
      underline="none"
      color="inherit"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: 'background.paper',
        border: `2px solid ${colors.yellow}`,
        borderRadius: `${String(radii.card)}px`,
        px: 2,
        py: 1.75,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          bgcolor: colors.lavenderTint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {tenancy ? initials(tenancy.tenantName) : ''}
      </Box>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 800, color: 'text.secondary' }}
        >
          {m.tenancy_title()}
        </Typography>
        <Typography sx={{ fontSize: 16, fontWeight: 900 }}>
          {tenancy ? tenancy.tenantName : m.tenancy_card_vacant()}
        </Typography>
        {tenancy ? (
          <Typography variant="body2" color="text.secondary">
            {props.showDueDay
              ? m.tenancy_card_details_due({
                  contract: contractShortLabel[tenancy.contractType](),
                  date: formatDate(tenancy.validFrom),
                  day: String(tenancy.dueDay),
                })
              : m.tenancy_card_details({
                  contract: contractShortLabel[tenancy.contractType](),
                  date: formatDate(tenancy.validFrom),
                })}
          </Typography>
        ) : null}
      </Stack>
      {rent ? (
        <Stack sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 900 }}>
            {m.amounts_per_month({ amount: formatMoney(rent.value) })}
          </Typography>
          {next ? (
            <Typography
              variant="body2"
              sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary' }}
            >
              {m.amounts_upcoming({
                date: formatDate(next.validFrom),
                amount: formatMoney(next.value),
              })}
            </Typography>
          ) : null}
        </Stack>
      ) : null}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 5 L16 12 L9 19" />
      </svg>
    </CardLink>
  )
}
