// A flat's Tenancy page (Design canvas: Vuokrasuhde, · irtisanottu,
// · vapaa, · vuokra ja muutokset): the current tenant with the status,
// contact links and contract details, its rent card, the flat's other
// tenancies with their latest rent, or the vacant prompt (openspec:
// tenancies, "The tenancy page"). Owners get the actions from the route.
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import type { DocumentRow } from '#/features/documents/document.repository.server'
import type { Period } from '#/features/recurring-amounts/periods'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { contractLabel, datesLabel, endingLabel, statusLabel } from './labels'
import { depositStatus, pendingReturns } from '#/features/deposits/deposit'
import { PendingReturnCard } from '#/features/deposits/PendingReturnCard'
import { DepositCard } from './DepositCard'
import { FeesCard } from './FeesCard'
import { LeaseCard } from './LeaseCard'
import type { FeeOfTenancy } from './fees'
import { OccupantsCard } from './OccupantsCard'
import { RentCard } from './RentCard'
import { currentTenancy, flatStatus, tenancyStatus } from './status'
import type { Tenancy } from './tenancy.repository.server'

export interface TenancyPageView {
  role: 'owner' | 'member'
  today: string
  /** Newest first. */
  tenancies: Tenancy[]
  /** Each tenancy's rent periods, oldest first. */
  rents: Partial<Record<string, readonly Period<number>[]>>
  /** Each tenancy's occupants periods, oldest first. */
  occupants: Partial<Record<string, readonly Period<number>[]>>
  /** Each tenancy's tenant fees. */
  fees: Partial<Record<string, readonly FeeOfTenancy[]>>
  /** The leases naming the current tenancy, newest first. */
  leases?: readonly DocumentRow[]
  /** Each tenancy's deposit return, if recorded. */
  depositReturns?: Partial<
    Record<string, { returnedOn: string; rentKept: number; damageKept: number }>
  >
}

interface Props {
  view: TenancyPageView
  address: string
  onBack: () => void
  /** Owners only: the Add tenant action (a link from the route). */
  addAction?: ReactNode
  /** Owners only: the actions for the current tenancy. */
  currentActions?: (tenancy: Tenancy) => ReactNode
  /** Owners only: wraps another tenancy's row, e.g. in a link to its form. */
  otherRow?: (tenancy: Tenancy, row: ReactNode) => ReactNode
  /** Owners only: adding an earlier tenancy while the flat has a current one. */
  earlierAction?: ReactNode
  /** Owners only: the link to change the current tenancy's rent. */
  rentChange?: (tenancy: Tenancy) => ReactNode
  /** Owners only: undoing the current tenancy's latest rent change. */
  onUndoRent?: (tenancy: Tenancy) => void
  /** Owners only: the link to add a fee to the current tenancy. */
  feeAdd?: (tenancy: Tenancy) => ReactNode
  /** Owners only: the link to change a fee of the current tenancy. */
  feeChange?: (tenancy: Tenancy, fee: FeeOfTenancy) => ReactNode
  /** Owners only: the link to the correction form that sets the deposit. */
  depositChange?: (tenancy: Tenancy) => ReactNode
  /** Owners only: the link that opens a tenancy's deposit return. */
  returnAction?: (tenancy: Tenancy) => ReactNode
  /** Wraps a lease's row in a link to its details page. */
  leaseLink?: (lease: DocumentRow, row: ReactNode) => ReactNode
  /** Owners only: the link that adds a lease to the current tenancy. */
  leaseAdd?: (tenancy: Tenancy) => ReactNode
  /** Owners only: opening the dialog that changes the occupants. */
  onChangeOccupants?: (tenancy: Tenancy) => void
  /** Owners only: undoing the latest occupants change. */
  onUndoOccupants?: (tenancy: Tenancy) => void
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
  rows.push([
    m.tenancy_due_day(),
    m.tenancy_due_day_value({ day: String(tenancy.dueDay) }),
  ])
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

/** A tenancy's latest rent, in cents. */
const latestRent = (rents: readonly Period<number>[] | undefined) =>
  rents?.at(-1)?.value

export function TenancyPage(props: Props) {
  const { view } = props
  const owner = view.role === 'owner'
  const current = currentTenancy(view.tenancies, view.today)
  const status = flatStatus(view.tenancies, view.today)
  const others = view.tenancies.filter((t) => t !== current)
  const returns = view.depositReturns ?? {}
  const pending = pendingReturns(
    view.tenancies,
    new Set(Object.keys(returns)),
    view.today,
  )
  const statusLine = (tenancy: Tenancy) => {
    const state = depositStatus(tenancy, returns[tenancy.id], view.today)
    switch (state.kind) {
      case 'none':
        return m.deposit_status_none()
      case 'held':
        return m.deposit_status_held({ amount: formatMoney(state.amount) })
      case 'pending':
        return m.deposit_status_pending()
      case 'returned':
        return state.kept > 0
          ? m.deposit_status_returned_kept({
              date: formatDate(state.on),
              amount: formatMoney(state.returned),
              kept: formatMoney(state.kept),
            })
          : m.deposit_status_returned({
              date: formatDate(state.on),
              amount: formatMoney(state.returned),
            })
    }
  }
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
        {pending.map((tenancy) => (
          <PendingReturnCard
            key={tenancy.id}
            tenantName={tenancy.tenantName}
            deposit={tenancy.deposit ?? 0}
            lastRentDay={tenancy.validTo ?? view.today}
            action={owner ? props.returnAction?.(tenancy) : undefined}
          />
        ))}
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
        {current ? (
          <OccupantsCard
            tenancy={current}
            occupants={view.occupants[current.id] ?? []}
            today={view.today}
            onChange={
              owner && props.onChangeOccupants
                ? () => props.onChangeOccupants?.(current)
                : undefined
            }
            onUndo={
              owner && props.onUndoOccupants
                ? () => props.onUndoOccupants?.(current)
                : undefined
            }
          />
        ) : null}
        {current ? (
          <RentCard
            tenancy={current}
            rents={view.rents[current.id] ?? []}
            today={view.today}
            change={owner ? props.rentChange?.(current) : undefined}
            onUndo={
              owner && props.onUndoRent
                ? () => props.onUndoRent?.(current)
                : undefined
            }
          />
        ) : null}
        {current ? (
          <FeesCard
            tenancy={current}
            fees={view.fees[current.id] ?? []}
            occupants={view.occupants[current.id] ?? []}
            rents={view.rents[current.id] ?? []}
            today={view.today}
            add={owner ? props.feeAdd?.(current) : undefined}
            change={
              owner && props.feeChange
                ? (fee) => props.feeChange?.(current, fee)
                : undefined
            }
          />
        ) : null}
        {current ? (
          <DepositCard
            deposit={current.deposit}
            action={owner ? props.depositChange?.(current) : undefined}
          />
        ) : null}
        {current ? (
          <LeaseCard
            leases={view.leases ?? []}
            link={props.leaseLink ?? ((_lease, row) => row)}
            add={owner ? props.leaseAdd?.(current) : undefined}
          />
        ) : null}
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
              {others.map((tenancy, i) => {
                const row = (
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'center', gap: 1.5, minHeight: 56 }}
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
                      <Typography variant="body2" color="text.secondary">
                        {statusLine(tenancy)}
                      </Typography>
                    </Stack>
                    <Stack sx={{ alignItems: 'flex-end' }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 800, color: 'text.secondary' }}
                      >
                        {statusLabel(tenancyStatus(tenancy, view.today))}
                      </Typography>
                      {latestRent(view.rents[tenancy.id]) ===
                      undefined ? null : (
                        <Typography sx={{ fontSize: 13, fontWeight: 900 }}>
                          {m.amounts_per_month({
                            amount: formatMoney(
                              latestRent(view.rents[tenancy.id]) ?? 0,
                            ),
                          })}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                )
                return (
                  <Box
                    key={tenancy.id}
                    component="li"
                    sx={{
                      borderTop:
                        i === 0 ? 'none' : `1px solid ${colors.divider}`,
                    }}
                  >
                    {owner && props.otherRow
                      ? props.otherRow(tenancy, row)
                      : row}
                  </Box>
                )
              })}
            </Box>
          </Stack>
        ) : null}
        {owner && current ? props.earlierAction : null}
        {owner ? null : (
          <Typography variant="body2" color="text.secondary">
            {m.tenancy_member_note()}
          </Typography>
        )}
      </Stack>
    </Stack>
  )
}
