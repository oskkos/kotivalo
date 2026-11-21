// A flat's Rent and charges page (Design canvas: Vastikkeet): the rent,
// maintenance charge and financing charge in effect today with any upcoming
// change, the financing charge treatment and the charges capitalised so far
// (openspec: recurring-amounts). Owners get the buttons to change them.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, type ReactNode } from 'react'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { RecurringAmountKind } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { KINDS, kindLabel, treatmentLabel } from './labels'
import { currentAndUpcoming } from './periods'
import type { RecurringAmountsView } from './recurring-amounts.server'

interface Props {
  view: RecurringAmountsView
  address: string
  onBack: () => void
  /** Opens the form for an amount, or for the treatment. */
  onEdit: (what: RecurringAmountKind | 'treatment') => void
}

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

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

/** "Aseta" or "Muuta", named after what it changes for screen readers. */
function EditButton(props: {
  set: boolean
  item: string
  onClick: () => void
}) {
  const action = props.set ? m.amounts_change() : m.amounts_set()
  return (
    <Button
      variant="outlined"
      aria-label={m.amounts_action_label({ action, item: props.item })}
      onClick={props.onClick}
      sx={{ flexShrink: 0, borderRadius: 999, minHeight: 44 }}
    >
      {action}
    </Button>
  )
}

function AmountCard(props: {
  kind: RecurringAmountKind
  view: RecurringAmountsView
  canEdit: boolean
  onEdit: () => void
  children?: ReactNode
}) {
  const headingId = useId()
  const label = kindLabel[props.kind]()
  const { current, upcoming } = currentAndUpcoming(
    props.view.amounts[props.kind],
    props.view.today,
  )
  const perMonth = (cents: number) =>
    m.amounts_per_month({ amount: formatMoney(cents) })
  return (
    <Stack
      component="section"
      aria-labelledby={headingId}
      sx={{ ...card, gap: 1.25, py: 1.75, pl: 2, pr: 1.75 }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Stack sx={{ flex: 1, minWidth: 0, gap: 0.25 }}>
          <Typography
            id={headingId}
            variant="body2"
            component="h2"
            sx={{ fontWeight: 800, color: 'text.secondary' }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: 24,
              fontWeight: 900,
              color: current ? 'text.primary' : 'text.secondary',
            }}
          >
            {current ? perMonth(current.value) : m.amounts_not_set()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {current
              ? m.amounts_from({ date: formatDate(current.validFrom) })
              : props.kind === 'rent'
                ? m.amounts_rent_hint()
                : m.amounts_charge_hint()}
          </Typography>
        </Stack>
        {props.canEdit ? (
          <EditButton
            set={props.view.amounts[props.kind].length > 0}
            item={label}
            onClick={props.onEdit}
          />
        ) : null}
      </Stack>
      {upcoming ? (
        <Box
          sx={{
            bgcolor: colors.yellowTint,
            borderRadius: `${String(radii.input)}px`,
            px: 1.5,
            py: 1,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {m.amounts_upcoming({
            date: formatDate(upcoming.validFrom),
            amount: perMonth(upcoming.value),
          })}
        </Box>
      ) : null}
      {props.children}
    </Stack>
  )
}

function Treatment(props: {
  view: RecurringAmountsView
  canEdit: boolean
  onEdit: () => void
}) {
  const { current } = currentAndUpcoming(
    props.view.treatments,
    props.view.today,
  )
  const label = m.amounts_treatment_label()
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        gap: 1.5,
        borderTop: `1px solid ${colors.divider}`,
        pt: 1.25,
      }}
    >
      <Stack sx={{ flex: 1, minWidth: 0, gap: 0.25 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 800, color: 'text.secondary' }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 900 }}>
          {current ? treatmentLabel[current.value]() : m.amounts_not_set()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {current
            ? `${m.amounts_from({ date: formatDate(current.validFrom) })} · ${
                current.value === 'capitalised'
                  ? m.amounts_treatment_capitalised_note()
                  : m.amounts_treatment_income_recognised_note()
              }`
            : m.amounts_treatment_not_set_note()}
        </Typography>
      </Stack>
      {props.canEdit ? (
        <EditButton
          set={props.view.treatments.length > 0}
          item={label}
          onClick={props.onEdit}
        />
      ) : null}
    </Stack>
  )
}

export function RecurringAmountsPage(props: Props) {
  const { view } = props
  const canEdit = view.role === 'owner'
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
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {m.amounts_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack component="main" sx={{ gap: 1.5, px: 2.5, pt: 1.25, pb: 3 }}>
        {KINDS.map((kind) => (
          <AmountCard
            key={kind}
            kind={kind}
            view={view}
            canEdit={canEdit}
            onEdit={() => {
              props.onEdit(kind)
            }}
          >
            {kind === 'financing_charge' ? (
              <Treatment
                view={view}
                canEdit={canEdit}
                onEdit={() => {
                  props.onEdit('treatment')
                }}
              />
            ) : null}
          </AmountCard>
        ))}
        {view.capitalised > 0 ? (
          <Box
            sx={{
              bgcolor: colors.lavenderTint,
              borderRadius: `${String(radii.input)}px`,
              px: 1.75,
              py: 1.5,
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            {m.amounts_capitalised_total({
              amount: formatMoney(view.capitalised),
            })}
          </Box>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {canEdit ? m.amounts_footnote() : m.amounts_member_note()}
        </Typography>
      </Stack>
    </Stack>
  )
}
