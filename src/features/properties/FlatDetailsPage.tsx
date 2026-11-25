// A flat's details page, its main page (Design canvas: Asunnon tiedot,
// · vapaa; openspec: properties, "The flat details page"): the flat and its
// owners, this month's rent card, earlier months not fully paid, the tenancy,
// the rent and charges, and the latest entries. Every section opens its page.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { useState } from 'react'
import { chargesOfYear } from '#/features/recurring-amounts/charges'
import { periodOn } from '#/features/recurring-amounts/periods'
import { kindLabel, treatmentLabel } from '#/features/recurring-amounts/labels'
import { rentMonthTitle } from '#/features/rent-payments/labels'
import { RecordPaymentDialog } from '#/features/rent-payments/RecordPaymentDialog'
import { PaidBar } from '#/features/rent-payments/RentMonthPage'
import { monthList } from '#/features/rent-payments/RentPaymentsPage'
import {
  monthsNotFullyPaid,
  rentMonth,
  type RentMonth,
} from '#/features/rent-payments/status'
import { StatusChip } from '#/features/rent-payments/StatusChip'
import { currentTenancy, flatStatus } from '#/features/tenancies/status'
import { TenancyCard } from '#/features/tenancies/TenancyCard'
import type { Tenancy } from '#/features/tenancies/tenancy.repository.server'
import { EntryRow } from '#/features/transactions/TransactionsPage'
import { clientLog } from '#/lib/client-log'
import { lastDayOfMonth, type IsoDate } from '#/lib/dates'
import { formatArea, formatDate, formatMoney } from '#/lib/format'
import {
  usageChargesOfMonth,
  usageChargesOfYear,
} from '#/features/usage-charges/months'
import { chargeName } from '#/lib/charge-labels'
import { m } from '#/paraglide/messages.js'
import { colors, radii, shadows } from '#/theme/tokens'
import { ArchiveDialog } from './ArchiveDialog'
import type { FlatDetails } from './details.server'
import { restoreProperty } from './functions'
import { ownershipLine } from './ownership-line'
import { roomCountLabel } from './room-count'

interface Props {
  view: FlatDetails
  /** After a payment was recorded: reload. */
  onChanged: () => Promise<void>
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

const TextLink = createLink(Link)
const IconLink = createLink(IconButton)
const ButtonLink = createLink(Button)
const MenuLink = createLink(MenuItem)

function Icon(props: { path: string; size?: number }) {
  const size = props.size ?? 24
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={props.path} />
    </svg>
  )
}

const BACK = 'M15 5 L8 12 L15 19'
const PEN = 'M4 20 H8 L19 9 L15 5 L4 16 Z M13 7 L17 11'
const NEXT = 'M9 5 L16 12 L9 19'
const ALERT = 'M12 3 L22 20 H2 Z M12 10 V14 M12 17 V17.01'
const CHECK = 'M5 12 L10 17 L19 7'
const PEOPLE =
  'M2.5 19 a5.5 5.5 0 0 1 11 0 M10.5 19 a5.5 5.5 0 0 1 11 0 M5 9 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M13 9 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0'

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

function Header(props: {
  propertyId: string
  owner: boolean
  canEnd: Tenancy | null
  archived: boolean
  onArchive: () => void
  onRestore: () => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const params = { propertyId: props.propertyId }
  const close = () => {
    setAnchor(null)
  }
  return (
    <Box
      component="header"
      sx={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr 44px 44px',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        pt: 2,
        pb: 0.5,
      }}
    >
      <IconLink to="/" aria-label={m.property_back_to_list()}>
        <Icon path={BACK} />
      </IconLink>
      <Typography
        variant="h3"
        component="h1"
        sx={{ fontSize: 17, textAlign: 'center' }}
      >
        {m.flat_details_title()}
      </Typography>
      <IconLink
        to="/properties/$propertyId/edit"
        params={params}
        aria-label={m.property_edit_title()}
      >
        <Icon path={PEN} size={22} />
      </IconLink>
      <IconButton
        aria-label={m.flat_details_menu()}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => {
          setAnchor(e.currentTarget)
        }}
      >
        <MenuIcon />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        slotProps={{
          paper: {
            sx: {
              borderRadius: `${String(radii.menu)}px`,
              boxShadow: shadows.menu,
              minWidth: 260,
            },
          },
        }}
      >
        <MenuLink to="/properties/$propertyId/edit" params={params}>
          {m.property_edit_title()}
        </MenuLink>
        {props.owner && props.canEnd ? (
          <MenuLink
            to="/properties/$propertyId/tenancy/$tenancyId/end"
            params={{ ...params, tenancyId: props.canEnd.id }}
          >
            {m.tenancy_end_title()}
          </MenuLink>
        ) : null}
        {props.owner ? (
          <MenuLink to="/properties/$propertyId/tenancy/new" params={params}>
            {m.tenancy_add()}
          </MenuLink>
        ) : null}
        <MenuLink to="/properties/$propertyId/amounts" params={params}>
          {m.amounts_title()}
        </MenuLink>
        <MenuLink to="/properties/$propertyId/rent" params={params}>
          {m.rent_payments_title()}
        </MenuLink>
        <MenuLink to="/properties/$propertyId/transactions" params={params}>
          {m.transactions_title()}
        </MenuLink>
        <MenuLink to="/properties/$propertyId/sharing" params={params}>
          {m.ownership_title()}
        </MenuLink>
        <Divider />
        {props.archived ? (
          <MenuItem
            onClick={() => {
              close()
              props.onRestore()
            }}
          >
            {m.property_restore()}
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              close()
              props.onArchive()
            }}
          >
            {m.property_archive()}
          </MenuItem>
        )}
      </Menu>
    </Box>
  )
}

/** The user has archived the flat: when, and the way back to the list. */
function ArchivedBand(props: {
  archivedOn: IsoDate
  busy: boolean
  onRestore: () => void
}) {
  return (
    <Stack
      component="section"
      aria-labelledby="archived-band-title"
      sx={{
        gap: 1,
        p: 1.75,
        bgcolor: colors.yellowTint,
        borderRadius: `${String(radii.card)}px`,
      }}
    >
      <Typography id="archived-band-title" variant="subtitle1" component="h2">
        {m.property_archived_on({ date: formatDate(props.archivedOn) })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {m.property_archived_text()}
      </Typography>
      <Button
        color="primary"
        loading={props.busy}
        onClick={props.onRestore}
        sx={{ alignSelf: 'flex-start' }}
      >
        {m.property_restore()}
      </Button>
    </Stack>
  )
}

function Hero(props: { view: FlatDetails }) {
  const { property, owners } = props.view
  return (
    <Stack
      component="section"
      aria-labelledby="flat-address"
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        borderRadius: `${String(radii.hero)}px`,
        px: 2.75,
        py: 2.25,
        gap: 0.5,
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: colors.yellow }}>
        {`${roomCountLabel(property.roomCount)} · ${formatArea(property.floorArea)}`}
      </Typography>
      <Typography
        id="flat-address"
        component="h2"
        sx={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}
      >
        {property.streetAddress}
      </Typography>
      <Typography
        sx={{ fontSize: 15, fontWeight: 700, color: colors.onPlumMuted }}
      >
        {`${property.postcode} ${property.city}`}
      </Typography>
      {owners.length > 0 ? (
        <TextLink
          to="/properties/$propertyId/sharing"
          params={{ propertyId: property.id }}
          underline="none"
          sx={{
            alignSelf: 'flex-start',
            mt: 1.25,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            minHeight: 36,
            px: 1.5,
            borderRadius: 999,
            bgcolor: colors.onPlumTint,
            color: 'primary.contrastText',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          <Icon path={PEOPLE} size={14} />
          {ownershipLine(owners)}
        </TextLink>
      ) : null}
    </Stack>
  )
}

function RentCard(props: {
  view: FlatDetails
  tenancy: Tenancy
  row: RentMonth | undefined
  onRecord: () => void
}) {
  const { view, tenancy, row } = props
  const month = view.today.slice(0, 7)
  const owner = view.role === 'owner'
  const late = row?.status.kind === 'late'
  const canRecord =
    owner &&
    row !== undefined &&
    (row.status.kind === 'due' ||
      row.status.kind === 'late' ||
      row.status.kind === 'partly_paid')
  return (
    <Stack
      component="section"
      aria-labelledby="rent-title"
      sx={{
        ...card,
        borderRadius: '22px',
        border: late ? `2px solid ${colors.lateBorder}` : card.border,
        px: 2,
        py: 1.75,
        gap: 1.25,
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <Stack>
          <Typography
            id="rent-title"
            component="h2"
            variant="body2"
            sx={{ fontWeight: 800, color: 'text.secondary' }}
          >
            {rentMonthTitle(month)}
          </Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 900 }}>
            {row?.expected === undefined ? '–' : formatMoney(row.expected)}
          </Typography>
        </Stack>
        {row ? (
          <StatusChip status={row.status} />
        ) : (
          <StatusChip
            status={{ kind: 'due', on: tenancy.validFrom }}
            text={m.tenancy_status_starts({
              date: formatDate(tenancy.validFrom),
            })}
          />
        )}
      </Stack>
      {row?.status.kind === 'partly_paid' && row.expected !== undefined ? (
        <Stack sx={{ gap: 0.5 }}>
          <PaidBar paid={row.paid} expected={row.expected} />
          <Typography variant="body2" color="text.secondary">
            {m.flat_details_partly_paid({
              paid: formatMoney(row.paid),
              missing: formatMoney(row.status.missing),
            })}
          </Typography>
        </Stack>
      ) : null}
      {row ? (
        <Stack direction="row" sx={{ gap: 1 }}>
          {canRecord ? (
            <Button
              onClick={props.onRecord}
              startIcon={<Icon path={CHECK} size={18} />}
              sx={{ flex: 1, minHeight: 48 }}
            >
              {row.status.kind === 'partly_paid'
                ? m.rent_payment_add()
                : m.flat_details_record()}
            </Button>
          ) : null}
          <ButtonLink
            to="/properties/$propertyId/rent/$tenancyId/$month"
            params={{
              propertyId: view.property.id,
              tenancyId: tenancy.id,
              month,
            }}
            variant="outlined"
            sx={{ flex: canRecord ? '0 0 auto' : 1, minHeight: 48, px: 2.5 }}
          >
            {m.rent_month_payments()}
          </ButtonLink>
        </Stack>
      ) : null}
    </Stack>
  )
}

function Vacant(props: { view: FlatDetails; since: string | null }) {
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
        py: 2.5,
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
          : m.tenancy_vacant_since({ date: formatDate(props.since) })}
      </Typography>
      {props.view.role === 'owner' ? (
        <ButtonLink
          to="/properties/$propertyId/tenancy/new"
          params={{ propertyId: props.view.property.id }}
          sx={{ alignSelf: 'stretch', minHeight: 48 }}
        >
          {m.tenancy_add()}
        </ButtonLink>
      ) : null}
    </Stack>
  )
}

function Unpaid(props: { propertyId: string; rows: RentMonth[] }) {
  const { rows } = props
  // The year of the newest month, so that the page opens on a year that
  // lists it.
  const year = Number(rows[0]?.month.slice(0, 4))
  return (
    <TextLink
      to="/properties/$propertyId/rent"
      params={{ propertyId: props.propertyId }}
      search={{ year }}
      underline="none"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minHeight: 48,
        bgcolor: colors.yellowTint,
        borderRadius: `${String(radii.tile)}px`,
        px: 1.75,
        py: 1,
        color: 'text.primary',
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      <Icon path={ALERT} size={20} />
      <Box component="span" sx={{ flex: 1 }}>
        {rows.length === 1
          ? m.flat_details_unpaid_one({ months: monthList(rows) })
          : m.flat_details_unpaid_many({ count: rows.length })}
      </Box>
      <Icon path={NEXT} size={18} />
    </TextLink>
  )
}

interface AmountRow {
  key: string
  label: string
  /** A second line under the label: a charge's name or the treatment. */
  note?: string
  /** Text on the right: an amount per month, a treatment, or not set. */
  value: string
}

/**
 * The rent, the maintenance charge and the financing charges in effect
 * today. One unnamed charge, or none, shows its treatment under it as
 * before; several show their names and the treatment once below them.
 */
function amountRows(view: FlatDetails): AmountRow[] {
  const perMonth = (cents: number | undefined) =>
    cents === undefined
      ? m.amounts_not_set()
      : m.amounts_per_month({ amount: formatMoney(cents) })
  const treatment = periodOn(view.treatments, view.today)?.value
  const treatmentText =
    treatment === undefined ? undefined : treatmentLabel[treatment]()
  const rows: AmountRow[] = [
    {
      key: 'maintenance',
      label: kindLabel.maintenance_charge(),
      value: perMonth(
        periodOn(view.amounts.maintenance_charge, view.today)?.value,
      ),
    },
  ]
  const active = view.financingCharges.flatMap((charge) => {
    const cents = periodOn(charge.periods, view.today)?.value
    return cents !== undefined && cents > 0 ? [{ charge, cents }] : []
  })
  const only = active.length === 1 ? active[0] : undefined
  if (active.length === 0 || only?.charge.name === null) {
    return [
      ...rows,
      {
        key: 'financing',
        label: kindLabel.financing_charge(),
        note: treatmentText,
        value: perMonth(only?.cents),
      },
    ]
  }
  return [
    ...rows,
    ...active.map(({ charge, cents }) => ({
      key: charge.id,
      label: kindLabel.financing_charge(),
      note: charge.name ?? undefined,
      value: perMonth(cents),
    })),
    {
      key: 'treatment',
      label: m.amounts_treatment_label(),
      value: treatmentText ?? m.amounts_not_set(),
    },
  ]
}

function Amounts(props: { view: FlatDetails }) {
  const { view } = props
  const year = Number(view.today.slice(0, 4))
  const chargesSoFar = chargesOfYear(
    {
      maintenance: view.amounts.maintenance_charge,
      financing: view.financingCharges,
    },
    view.treatments,
    year,
    view.today,
  ).total
  return (
    <Stack
      component="section"
      aria-labelledby="amounts-title"
      sx={{ gap: 0.75 }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography
          id="amounts-title"
          variant="h3"
          component="h2"
          sx={{ fontSize: 15 }}
        >
          {m.amounts_title()}
        </Typography>
        <TextLink
          to="/properties/$propertyId/amounts"
          params={{ propertyId: view.property.id }}
          sx={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            fontWeight: 800,
          }}
        >
          {m.amounts_change()}
        </TextLink>
      </Stack>
      <Box sx={{ ...card, overflow: 'hidden' }}>
        <Box component="dl" sx={{ m: 0, px: 2 }}>
          {amountRows(view).map((row, i) => (
            <Stack
              key={row.key}
              direction="row"
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1.5,
                minHeight: 48,
                py: 0.5,
                borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
              }}
            >
              <Typography
                component="dt"
                sx={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'text.secondary',
                }}
              >
                {row.label}
                {row.note === undefined ? null : (
                  <Box
                    component="span"
                    sx={{ display: 'block', fontSize: 12, fontWeight: 700 }}
                  >
                    {row.note}
                  </Box>
                )}
              </Typography>
              <Typography
                component="dd"
                sx={{ m: 0, fontSize: 15, fontWeight: 900 }}
              >
                {row.value}
              </Typography>
            </Stack>
          ))}
        </Box>
        <TextLink
          to="/properties/$propertyId/charges"
          params={{ propertyId: view.property.id }}
          underline="none"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 60,
            pl: 2,
            pr: 1.5,
            py: 1,
            borderTop: `1px solid ${colors.cardBorder}`,
            color: 'text.primary',
          }}
        >
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Box component="span" sx={{ fontSize: 15, fontWeight: 900 }}>
              {m.flat_details_charges()}
            </Box>
            {chargesSoFar > 0 ? (
              <Box
                component="span"
                sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}
              >
                {m.flat_details_charges_so_far({
                  year: String(year),
                  amount: formatMoney(chargesSoFar),
                })}
              </Box>
            ) : null}
          </Stack>
          <Icon path={NEXT} size={18} />
        </TextLink>
      </Box>
      {view.capitalised > 0 ? (
        <Typography
          sx={{
            bgcolor: colors.lavenderTint,
            borderRadius: `${String(radii.tile)}px`,
            px: 1.75,
            py: 1.5,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {m.amounts_capitalised_total({
            amount: formatMoney(view.capitalised),
          })}
        </Typography>
      ) : null}
    </Stack>
  )
}

function UsageCharges(props: { view: FlatDetails }) {
  const { view } = props
  const year = Number(view.today.slice(0, 4))
  const tenancies = view.tenancies.map((t) => ({
    validFrom: t.validFrom,
    validTo: t.validTo,
    occupants: view.tenancyOccupants[t.id] ?? [],
  }))
  const month = usageChargesOfMonth(
    view.usageCharges,
    tenancies,
    view.today.slice(0, 7),
  )
  const rows = (month?.charges ?? []).filter((charge) => charge.cents > 0)
  const soFar = usageChargesOfYear(
    view.usageCharges,
    tenancies,
    year,
    view.today,
  ).total
  return (
    <Stack
      component="section"
      aria-labelledby="usage-charges-title"
      sx={{ gap: 0.75 }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography
          id="usage-charges-title"
          variant="h3"
          component="h2"
          sx={{ fontSize: 15 }}
        >
          {m.usage_charges_title()}
        </Typography>
        <TextLink
          to="/properties/$propertyId/usage-charges"
          params={{ propertyId: view.property.id }}
          sx={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            fontWeight: 800,
          }}
        >
          {m.flat_details_usage_charges_open()}
        </TextLink>
      </Stack>
      <Box sx={{ ...card, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <Typography sx={{ px: 2, py: 1.5, fontSize: 14, fontWeight: 800 }}>
            {m.usage_charges_none()}
          </Typography>
        ) : (
          <Box component="dl" sx={{ m: 0, px: 2 }}>
            {rows.map((row, i) => (
              <Stack
                key={row.id}
                direction="row"
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1.5,
                  minHeight: 48,
                  py: 0.5,
                  borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
                }}
              >
                <Typography
                  component="dt"
                  sx={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'text.secondary',
                  }}
                >
                  {chargeName(row)}
                  {row.persons === null ? null : (
                    <Box
                      component="span"
                      sx={{ display: 'block', fontSize: 12, fontWeight: 700 }}
                    >
                      {m.usage_charge_per_occupant_short({
                        amount: formatMoney(row.perUnit),
                        occupants: m.occupants_count({ persons: row.persons }),
                      })}
                    </Box>
                  )}
                </Typography>
                <Typography
                  component="dd"
                  sx={{ m: 0, fontSize: 15, fontWeight: 900 }}
                >
                  {m.amounts_per_month({ amount: formatMoney(row.cents) })}
                </Typography>
              </Stack>
            ))}
          </Box>
        )}
        <TextLink
          to="/properties/$propertyId/usage-charges/months"
          params={{ propertyId: view.property.id }}
          underline="none"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 60,
            pl: 2,
            pr: 1.5,
            py: 1,
            borderTop: `1px solid ${colors.cardBorder}`,
            color: 'text.primary',
          }}
        >
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Box component="span" sx={{ fontSize: 15, fontWeight: 900 }}>
              {m.usage_charges_months_title()}
            </Box>
            {soFar > 0 ? (
              <Box
                component="span"
                sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}
              >
                {m.flat_details_charges_so_far({
                  year: String(year),
                  amount: formatMoney(soFar),
                })}
              </Box>
            ) : null}
          </Stack>
          <Icon path={NEXT} size={18} />
        </TextLink>
      </Box>
    </Stack>
  )
}

function Latest(props: { view: FlatDetails }) {
  const { view } = props
  return (
    <Stack
      component="section"
      aria-labelledby="latest-title"
      sx={{ gap: 0.75 }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography
          id="latest-title"
          variant="h3"
          component="h2"
          sx={{ fontSize: 15 }}
        >
          {m.flat_details_latest()}
        </Typography>
        <TextLink
          to="/properties/$propertyId/transactions"
          params={{ propertyId: view.property.id }}
          sx={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            fontWeight: 800,
          }}
        >
          {m.flat_details_all()}
        </TextLink>
      </Stack>
      {view.latestEntries.length === 0 ? (
        <Typography
          sx={{ ...card, px: 2, py: 1.75, fontSize: 14, fontWeight: 800 }}
        >
          {m.flat_details_no_entries()}
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{ ...card, m: 0, p: 0, listStyle: 'none', overflow: 'hidden' }}
        >
          {view.latestEntries.map((entry, i) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              propertyId={view.property.id}
              first={i === 0}
            />
          ))}
        </Box>
      )}
    </Stack>
  )
}

export function FlatDetailsPage(props: Props) {
  const { view } = props
  const owner = view.role === 'owner'
  const month = view.today.slice(0, 7)
  const current = currentTenancy(view.tenancies, view.today)
  const status = flatStatus(view.tenancies, view.today)
  const data = {
    tenancies: view.tenancies,
    rents: view.tenancyRents,
    occupants: view.tenancyOccupants,
    fees: view.tenancyFees,
    payments: view.payments,
    today: view.today,
  }
  // A tenancy that starts after this month has no rent this month.
  const row =
    current && current.validFrom <= lastDayOfMonth(month)
      ? rentMonth(current, month, data)
      : undefined
  // The rent card shows the current tenancy's month; an earlier tenancy that
  // ended this month is warned about with the other months.
  const unpaid = monthsNotFullyPaid(data).filter(
    (r) => !(r.month === month && r.tenancy.id === row?.tenancy.id),
  )
  const canEnd =
    current?.noticeGivenBy === null && current.validFrom <= view.today
      ? current
      : null
  const [recording, setRecording] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function restore() {
    setRestoring(true)
    try {
      await restoreProperty({ data: { id: view.property.id } })
      await props.onChanged()
    } catch (error) {
      clientLog.error('property.restore_failed', {}, error)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Header
        propertyId={view.property.id}
        owner={owner}
        canEnd={canEnd}
        archived={view.archivedOn !== null}
        onArchive={() => {
          setArchiving(true)
        }}
        onRestore={() => {
          void restore()
        }}
      />
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 1, pb: 3 }}
      >
        {view.archivedOn === null ? null : (
          <ArchivedBand
            archivedOn={view.archivedOn}
            busy={restoring}
            onRestore={() => {
              void restore()
            }}
          />
        )}
        <Hero view={view} />
        {current ? (
          <RentCard
            view={view}
            tenancy={current}
            row={row}
            onRecord={() => {
              setRecording(true)
            }}
          />
        ) : (
          <Vacant
            view={view}
            since={status.kind === 'vacant' ? status.since : null}
          />
        )}
        {unpaid.length > 0 ? (
          <Unpaid propertyId={view.property.id} rows={unpaid} />
        ) : null}
        {current ? (
          <TenancyCard
            propertyId={view.property.id}
            tenancy={current}
            rents={view.tenancyRents[current.id] ?? []}
            occupants={view.tenancyOccupants[current.id] ?? []}
            fees={view.tenancyFees[current.id] ?? []}
            today={view.today}
            showDueDay
          />
        ) : null}
        <Amounts view={view} />
        <UsageCharges view={view} />
        <Latest view={view} />
      </Stack>
      {archiving ? (
        <ArchiveDialog
          property={view.property}
          open
          onClose={() => {
            setArchiving(false)
          }}
        />
      ) : null}
      {recording && current && row ? (
        <RecordPaymentDialog
          propertyId={view.property.id}
          tenancy={current}
          month={month}
          missing={row.missing}
          withFees={row.parts.length > 1}
          today={view.today}
          open
          onClose={() => {
            setRecording(false)
          }}
          onDone={async () => {
            setRecording(false)
            await props.onChanged()
          }}
        />
      ) : null}
    </Stack>
  )
}
