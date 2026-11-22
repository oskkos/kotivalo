// The flats list, the home page (Design canvas: "Asunnot"): the header, the
// title with the count, and a card per flat. Owners, rent status and the
// monthly summary come with their own features.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Logo, LogoMark } from '#/components/Logo'
import { formatArea } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import type { Property } from './property'
import { ownershipLine, type CardOwner } from './ownership-line'
import { roomCountLabel } from './room-count'

interface Props {
  properties: readonly Property[]
  /** The current owners by flat id, for each card's ownership line. */
  owners?: Readonly<Record<string, readonly CardOwner[]>>
  /** Each card's tenancy status by flat id, e.g. a chip. */
  statuses?: Readonly<Record<string, ReactNode>>
  /** The bottom navigation bar. */
  bottomNav?: ReactNode
  /** Shown above the list or the empty state, e.g. flat invitations. */
  notices?: ReactNode
}

function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5 V19 M5 12 H19" />
    </svg>
  )
}

export function PropertyCard({
  property,
  owners = [],
  status,
}: {
  property: Property
  owners?: readonly CardOwner[] | undefined
  /** The tenancy status, e.g. a chip. */
  status?: ReactNode
}) {
  const ownership = ownershipLine(owners)
  return (
    <Link
      to="/properties/$propertyId"
      params={{ propertyId: property.id }}
      style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.75,
          p: 1.75,
          bgcolor: 'background.paper',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: `${String(radii.card)}px`,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '18px',
            bgcolor: colors.yellowTint,
          }}
        >
          <LogoMark size={34} />
        </Box>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" component="span">
            {property.streetAddress}
          </Typography>
          <Typography variant="body2" component="span" color="text.secondary">
            {m.property_card_details({
              city: property.city,
              rooms: roomCountLabel(property.roomCount),
              area: formatArea(property.floorArea),
            })}
          </Typography>
          {ownership === '' ? null : (
            <Typography
              variant="caption"
              component="span"
              color="text.secondary"
              sx={{ fontWeight: 800 }}
            >
              {ownership}
            </Typography>
          )}
          {status}
        </Stack>
      </Box>
    </Link>
  )
}

/** No flats yet: what Kotivalo is for, and the way to the first flat. */
function EmptyState() {
  return (
    <Stack
      sx={{
        alignItems: 'center',
        gap: 1,
        px: 3,
        py: 4,
        textAlign: 'center',
        border: `1.5px dashed ${colors.dashed}`,
        borderRadius: `${String(radii.card)}px`,
      }}
    >
      <LogoMark size={72} roof={colors.plum} />
      <Typography variant="h3" component="h2" sx={{ mt: 1 }}>
        {m.properties_empty_title()}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {m.properties_empty_text()}
      </Typography>
      <Button
        component={Link}
        to="/properties/new"
        color="accent"
        startIcon={<PlusIcon />}
        sx={{ mt: 1.5 }}
      >
        {m.property_add()}
      </Button>
    </Stack>
  )
}

function Header(): ReactNode {
  return (
    <Stack
      component="header"
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        pl: 2.5,
        pr: 1.5,
        pt: 2,
        pb: 0.5,
      }}
    >
      <Logo size={28} />
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <IconButton
          component={Link}
          to="/properties/new"
          aria-label={m.property_add()}
          sx={{
            border: `1.5px solid ${colors.inputBorder}`,
            bgcolor: 'background.paper',
          }}
        >
          <PlusIcon />
        </IconButton>
      </Stack>
    </Stack>
  )
}

export function PropertyList({
  properties,
  owners = {},
  statuses = {},
  bottomNav,
  notices,
}: Props) {
  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Header />
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 1, pb: 4 }}
      >
        <Stack>
          <Typography variant="h1">{m.properties_title()}</Typography>
          {properties.length === 0 ? null : (
            <Typography variant="body2" color="text.secondary">
              {m.properties_count({ count: properties.length })}
            </Typography>
          )}
        </Stack>
        {notices}
        {properties.length === 0 ? (
          <EmptyState />
        ) : (
          <Stack
            component="ul"
            sx={{ gap: 1.25, m: 0, p: 0, listStyle: 'none' }}
          >
            {properties.map((property) => (
              <li key={property.id}>
                <PropertyCard
                  property={property}
                  owners={owners[property.id]}
                  status={statuses[property.id]}
                />
              </li>
            ))}
          </Stack>
        )}
      </Stack>
      {bottomNav}
    </Stack>
  )
}
