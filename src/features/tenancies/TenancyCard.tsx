// The tenancy card at the top of a flat's edit page (Design canvas: Muokkaa
// asuntoa · vuokrasuhdekortti): the current tenant with the contract type and
// start, or "Vapaa"; it opens the Tenancy page (openspec: properties,
// "Editing a flat").
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { formatDate } from '#/lib/format'
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
}) {
  const { tenancy } = props
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
