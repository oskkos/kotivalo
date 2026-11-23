// A flat's Rent and charges page (Design canvas: Vastikkeet,
// RahoitusVastikkeet): the rent and maintenance charge in effect today with
// any upcoming change, the financing charges in one card with the treatment
// that applies to all of them, and the charges capitalised so far (openspec:
// recurring-amounts). Owners get the buttons to change and add them.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId } from 'react'
import { dayBefore } from '#/lib/dates'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { FinancingCharge } from './recurring-amount.repository.server'
import { colors, radii } from '#/theme/tokens'
import {
  KINDS,
  chargeLabel,
  kindLabel,
  treatmentLabel,
  type SingleKind,
} from './labels'
import { currentAndUpcoming, isEnded, periodOn } from './periods'
import type { RecurringAmountsView } from './recurring-amounts.server'

interface Props {
  view: RecurringAmountsView
  address: string
  onBack: () => void
  /** Opens the form for an amount, or for the treatment. */
  onEdit: (what: SingleKind | 'treatment') => void
  /** Opens the form of a financing charge. */
  onEditCharge: (chargeId: string) => void
  onAddCharge: () => void
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
  kind: SingleKind
  view: RecurringAmountsView
  canEdit: boolean
  onEdit: () => void
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
    </Stack>
  )
}

function Treatment(props: {
  view: RecurringAmountsView
  canEdit: boolean
  /** Several financing charges: say that it applies to all of them. */
  all: boolean
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
          {props.all ? m.amounts_treatment_label_all() : label}
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

function ChargeRow(props: {
  charge: FinancingCharge
  view: RecurringAmountsView
  /** The only charge, without a name: the card's heading names it. */
  showName: boolean
  canEdit: boolean
  onEdit: () => void
}) {
  const { current, upcoming } = currentAndUpcoming(
    props.charge.periods,
    props.view.today,
  )
  // A charge that starts later shows its first amount.
  const shown = current ?? upcoming
  const next = current ? upcoming : undefined
  const label = chargeLabel(props.charge)
  const perMonth = (cents: number) =>
    m.amounts_per_month({ amount: formatMoney(cents) })
  return (
    <Stack
      component="li"
      sx={{
        gap: 1,
        py: 1.25,
        '& + &': { borderTop: `1px solid ${colors.divider}` },
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Stack sx={{ flex: 1, minWidth: 0, gap: 0.25 }}>
          {props.showName ? (
            <Typography sx={{ fontSize: 15, fontWeight: 900 }}>
              {label}
            </Typography>
          ) : null}
          <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
            {shown ? perMonth(shown.value) : m.amounts_not_set()}
          </Typography>
          {shown ? (
            <Typography variant="body2" color="text.secondary">
              {m.amounts_from({ date: formatDate(shown.validFrom) })}
            </Typography>
          ) : null}
        </Stack>
        {props.canEdit ? (
          <EditButton set item={label} onClick={props.onEdit} />
        ) : null}
      </Stack>
      {next ? (
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
            date: formatDate(next.validFrom),
            amount: perMonth(next.value),
          })}
        </Box>
      ) : null}
    </Stack>
  )
}

/**
 * The flat's financing charges in one card (Design canvas:
 * RahoitusVastikkeet): each charge, their sum per month when there are
 * several, adding a charge, and the treatment that applies to all.
 */
function FinancingCharges(props: {
  view: RecurringAmountsView
  canEdit: boolean
  onEditCharge: (chargeId: string) => void
  onAddCharge: () => void
  onEditTreatment: () => void
}) {
  const headingId = useId()
  const charges = props.view.financingCharges.filter(
    (charge) => !isEnded(charge.periods, props.view.today),
  )
  const several = charges.length > 1
  const unnamedOnly = charges.length === 1 && charges[0]?.name === null
  const total = charges.reduce(
    (sum, charge) =>
      sum + (periodOn(charge.periods, props.view.today)?.value ?? 0),
    0,
  )
  return (
    <Stack
      component="section"
      aria-labelledby={headingId}
      sx={{ ...card, pt: 1.75, pb: 1.5, pl: 2, pr: 1.75 }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Typography
          id={headingId}
          variant="body2"
          component="h2"
          sx={{ fontWeight: 800, color: 'text.secondary' }}
        >
          {several
            ? m.amounts_financing_charges()
            : m.amounts_financing_charge()}
        </Typography>
        {several ? (
          <Typography variant="body2" sx={{ fontWeight: 900 }}>
            {m.amounts_financing_total({
              amount: m.amounts_per_month({ amount: formatMoney(total) }),
            })}
          </Typography>
        ) : null}
      </Stack>
      {charges.length === 0 ? (
        <Typography
          sx={{ fontSize: 15, fontWeight: 900, color: 'text.secondary', py: 1 }}
        >
          {m.amounts_financing_none()}
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-labelledby={headingId}
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {charges.map((charge) => (
            <ChargeRow
              key={charge.id}
              charge={charge}
              view={props.view}
              showName={!unnamedOnly}
              canEdit={props.canEdit}
              onEdit={() => {
                props.onEditCharge(charge.id)
              }}
            />
          ))}
        </Box>
      )}
      {props.canEdit ? (
        <Button
          variant="text"
          onClick={props.onAddCharge}
          startIcon={<PlusIcon />}
          sx={{ alignSelf: 'flex-start', minHeight: 44, px: 0.5, mb: 1 }}
        >
          {m.amounts_financing_add()}
        </Button>
      ) : null}
      <Treatment
        view={props.view}
        canEdit={props.canEdit}
        all={several}
        onEdit={props.onEditTreatment}
      />
    </Stack>
  )
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
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

/**
 * Financing charges that have ended, below the card: when each ended and
 * the amount before it (spec: "Ending a financing charge").
 */
function EndedCharges(props: {
  view: RecurringAmountsView
  canEdit: boolean
  onEditCharge: (chargeId: string) => void
}) {
  const headingId = useId()
  const ended = props.view.financingCharges.filter((charge) =>
    isEnded(charge.periods, props.view.today),
  )
  if (ended.length === 0) {
    return null
  }
  return (
    <Stack component="section" aria-labelledby={headingId} sx={{ gap: 0.75 }}>
      <Typography
        id={headingId}
        variant="body2"
        component="h2"
        sx={{ fontWeight: 800, color: 'text.secondary', px: 0.5 }}
      >
        {m.amounts_charge_ended_title()}
      </Typography>
      <Stack
        component="ul"
        aria-labelledby={headingId}
        sx={{ listStyle: 'none', m: 0, p: 0, gap: 0.75 }}
      >
        {ended.map((charge) => {
          const last = charge.periods.at(-1)
          const before = charge.periods.at(-2)
          const detail =
            last && before
              ? m.amounts_charge_ended({
                  date: formatDate(dayBefore(last.validFrom)),
                  amount: m.amounts_per_month({
                    amount: formatMoney(before.value),
                  }),
                })
              : undefined
          const content = (
            <Stack sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 900 }}>
                {chargeLabel(charge)}
              </Typography>
              {detail ? (
                <Typography variant="body2" color="text.secondary">
                  {detail}
                </Typography>
              ) : null}
            </Stack>
          )
          return (
            <Box component="li" key={charge.id}>
              {props.canEdit ? (
                <Button
                  variant="text"
                  color="inherit"
                  fullWidth
                  onClick={() => {
                    props.onEditCharge(charge.id)
                  }}
                  sx={{ ...endedRow, justifyContent: 'flex-start' }}
                >
                  {content}
                </Button>
              ) : (
                <Box sx={{ ...endedRow, display: 'flex' }}>{content}</Box>
              )}
            </Box>
          )
        })}
      </Stack>
    </Stack>
  )
}

const endedRow = {
  ...card,
  borderRadius: `${String(radii.input)}px`,
  minHeight: 52,
  px: 2,
  py: 0.75,
  fontWeight: 'inherit',
} as const

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
          />
        ))}
        <FinancingCharges
          view={view}
          canEdit={canEdit}
          onEditCharge={props.onEditCharge}
          onAddCharge={props.onAddCharge}
          onEditTreatment={() => {
            props.onEdit('treatment')
          }}
        />
        <EndedCharges
          view={view}
          canEdit={canEdit}
          onEditCharge={props.onEditCharge}
        />
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
