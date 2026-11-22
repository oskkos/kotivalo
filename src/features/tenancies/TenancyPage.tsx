// A flat's Tenancy page (Design canvas: Vuokrasuhde, · irtisanottu,
// · vapaa): the current tenant with the status, contact links and contract
// details, the flat's other tenancies, or the vacant prompt (openspec:
// tenancies, "The tenancy page"). Owners get the actions from the route.
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { contractLabel, datesLabel, endingLabel, statusLabel } from './labels'
import { currentTenancy, flatStatus, tenancyStatus } from './status'
import type { Tenancy } from './tenancy.repository.server'

export interface TenancyPageView {
  role: 'owner' | 'member'
  today: string
  /** Newest first. */
  tenancies: Tenancy[]
  rentToday: number | null
}

interface Props {
  view: TenancyPageView
  address: string
  onBack: () => void
  /** Owners only: the Add tenant action (a link from the route). */
  addAction?: ReactNode
  /** Owners only: the actions for the current tenancy. */
  currentActions?: (tenancy: Tenancy) => ReactNode
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

function BackIcon() {
  return (
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
  )
}

/** Up to two initials of a name, for the avatar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function Avatar(props: { name: string; size?: number }) {
  const size = props.size ?? 48
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: colors.lavenderTint,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size / 3,
        fontWeight: 900,
        flexShrink: 0,
      }}
    >
      {initials(props.name)}
    </Box>
  )
}

function Chip(props: { tone: 'green' | 'yellow' | 'lavender'; text: string }) {
  const bg = {
    green: colors.greenTint,
    yellow: colors.yellowTint,
    lavender: colors.lavenderTint,
  }[props.tone]
  return (
    <Box
      component="span"
      sx={{
        alignSelf: 'flex-start',
        bgcolor: bg,
        borderRadius: 999,
        px: 1.25,
        py: 0.5,
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {props.text}
    </Box>
  )
}

function Rows(props: { rows: [string, string][] }) {
  return (
    <Box component="dl" sx={{ m: 0 }}>
      {props.rows.map(([label, value], i) => (
        <Stack
          key={label}
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 44,
            borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
          }}
        >
          <Typography
            component="dt"
            variant="body2"
            sx={{ fontWeight: 800, color: 'text.secondary' }}
          >
            {label}
          </Typography>
          <Typography
            component="dd"
            sx={{ m: 0, fontSize: 14, fontWeight: 900, textAlign: 'right' }}
          >
            {value}
          </Typography>
        </Stack>
      ))}
    </Box>
  )
}

function Current(props: {
  tenancy: Tenancy
  view: TenancyPageView
  actions?: ReactNode
}) {
  const { tenancy, view } = props
  const status = tenancyStatus(tenancy, view.today)
  const tone =
    status.kind === 'active'
      ? 'green'
      : status.kind === 'starts'
        ? 'lavender'
        : 'yellow'
  const rows: [string, string][] = [
    [m.tenancy_contract(), contractLabel[tenancy.contractType]()],
    [m.tenancy_contract_made(), formatDate(tenancy.contractMade)],
    [m.tenancy_start(), formatDate(tenancy.validFrom)],
  ]
  if (tenancy.noticeGivenBy !== null && tenancy.validTo !== null) {
    rows.push([m.tenancy_last_day(), formatDate(tenancy.validTo)])
  } else if (tenancy.termEnd !== null) {
    rows.push([m.tenancy_term_end(), formatDate(tenancy.termEnd)])
  }
  rows.push(
    [
      m.tenancy_rent(),
      view.rentToday === null
        ? m.tenancy_rent_not_set()
        : m.tenancy_rent_value({ amount: formatMoney(view.rentToday) }),
    ],
    [
      m.tenancy_due_day(),
      m.tenancy_due_day_value({ day: String(tenancy.dueDay) }),
    ],
  )
  if (tenancy.noticeGivenBy !== null && tenancy.noticeDate !== null) {
    rows.push([
      m.tenancy_ending(),
      m.tenancy_ending_value({
        how: endingLabel[tenancy.noticeGivenBy](),
        date: formatDate(tenancy.noticeDate),
      }),
    ])
  }
  const contact = {
    minHeight: 44,
    borderRadius: `${String(radii.input)}px`,
    bgcolor: 'background.default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
    color: 'text.primary',
    textDecoration: 'none',
  } as const
  return (
    <Stack
      component="section"
      aria-labelledby="tenant-name"
      sx={{ ...card, gap: 1.25, px: 2, py: 1.75 }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Avatar name={tenancy.tenantName} />
        <Stack sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
          <Typography
            id="tenant-name"
            component="h2"
            sx={{ fontSize: 18, fontWeight: 900 }}
          >
            {tenancy.tenantName}
          </Typography>
          <Chip tone={tone} text={statusLabel(status)} />
        </Stack>
      </Stack>
      {tenancy.tenantPhone !== null || tenancy.tenantEmail !== null ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
            gap: 1,
          }}
        >
          {tenancy.tenantPhone !== null ? (
            <Link
              href={`tel:${tenancy.tenantPhone.replace(/\s/g, '')}`}
              aria-label={m.tenancy_call({ phone: tenancy.tenantPhone })}
              sx={contact}
            >
              {tenancy.tenantPhone}
            </Link>
          ) : null}
          {tenancy.tenantEmail !== null ? (
            <Link
              href={`mailto:${tenancy.tenantEmail}`}
              aria-label={m.tenancy_email_label({ email: tenancy.tenantEmail })}
              sx={contact}
            >
              {m.tenancy_email()}
            </Link>
          ) : null}
        </Box>
      ) : null}
      <Rows rows={rows} />
      {props.actions}
    </Stack>
  )
}

function Vacant(props: { since: string | null; action?: ReactNode }) {
  return (
    <Stack
      component="section"
      aria-labelledby="vacant-title"
      sx={{
        ...card,
        border: `1.5px dashed ${colors.dashed}`,
        alignItems: 'center',
        textAlign: 'center',
        gap: 1.25,
        px: 2.25,
        py: 2.75,
      }}
    >
      <Typography
        id="vacant-title"
        component="h2"
        sx={{ fontSize: 18, fontWeight: 900 }}
      >
        {m.tenancy_vacant_title()}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {props.since === null
          ? m.tenancy_vacant_none()
          : m.tenancy_vacant_since({ date: formatDate(props.since) })}{' '}
        {m.tenancy_vacant_prompt()}
      </Typography>
      {props.action}
    </Stack>
  )
}

export function TenancyPage(props: Props) {
  const { view } = props
  const owner = view.role === 'owner'
  const current = currentTenancy(view.tenancies, view.today)
  const status = flatStatus(view.tenancies, view.today)
  const others = view.tenancies.filter((t) => t !== current)
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
        <IconButton aria-label={m.tenancy_back()} onClick={props.onBack}>
          <BackIcon />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {m.tenancy_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack component="main" sx={{ gap: 1.75, px: 2.5, pt: 1.25, pb: 3 }}>
        {current ? (
          <Current
            tenancy={current}
            view={view}
            actions={owner ? props.currentActions?.(current) : undefined}
          />
        ) : (
          <Vacant
            since={status.kind === 'vacant' ? status.since : null}
            action={owner ? props.addAction : undefined}
          />
        )}
        {others.length > 0 ? (
          <Stack
            component="section"
            aria-labelledby="others"
            sx={{ gap: 0.75 }}
          >
            <Typography
              id="others"
              component="h2"
              sx={{ fontSize: 15, fontWeight: 900 }}
            >
              {m.tenancy_others()}
            </Typography>
            <Box
              component="ul"
              sx={{ ...card, m: 0, px: 2, py: 0, listStyle: 'none' }}
            >
              {others.map((tenancy, i) => (
                <Stack
                  key={tenancy.id}
                  component="li"
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    gap: 1.5,
                    minHeight: 56,
                    borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
                  }}
                >
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 900 }}>
                      {tenancy.tenantName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {m.tenancy_other_line({
                        dates: datesLabel(tenancy.validFrom, tenancy.validTo),
                        contract: contractLabel[tenancy.contractType](),
                      })}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 800, color: 'text.secondary' }}
                  >
                    {statusLabel(tenancyStatus(tenancy, view.today))}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Stack>
        ) : null}
        {owner ? null : (
          <Typography variant="body2" color="text.secondary">
            {m.tenancy_member_note()}
          </Typography>
        )}
      </Stack>
    </Stack>
  )
}
