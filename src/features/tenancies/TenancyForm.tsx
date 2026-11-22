// Adding a tenant and correcting a tenancy (Design canvas: Uusi vuokralainen,
// · virheet): the tenant, the contract type, contract made (following the
// start until edited), the start, a fixed term's end, the rent (new tenants
// only, from the rent in effect on the start date) and the due day
// (openspec: tenancies, "Adding a tenant", "The rent of a new tenancy",
// "Correcting a tenancy").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useRef, useState, type ReactNode } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { ChoiceField } from '#/components/form/ChoiceField'
import { TextField } from '#/components/form/TextField'
import { typedDate } from '#/features/ownership/schemas'
import { periodOn, type Period } from '#/features/recurring-amounts/periods'
import { typedAmount } from '#/features/recurring-amounts/schemas'
import { clientLog } from '#/lib/client-log'
import { parseFiDate, type IsoDate } from '#/lib/dates'
import { formatAmountInput, formatDate } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import type { NoticeGiver } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { createTenancy, updateTenancy } from './functions'
import {
  EndingHint,
  EndingWayPicker,
  hintFor,
  LAST_DAY_REASONS,
  NOTICE_REASONS,
  noticeDateLabel,
  suggestedLastDay,
  waysFor,
} from './ending'
import { contractShortLabel } from './labels'
import { rentAsked } from './rent'
import {
  typedDueDay,
  typedTenantEmail,
  typedTenantName,
  typedTenantPhone,
} from './schemas'
import type { Tenancy } from './tenancy.repository.server'

interface Props {
  propertyId: string
  address: string
  /** Correcting: the tenancy. Adding: none. */
  editing?: Tenancy
  /** Adding: the flat's rent periods, oldest first. */
  rents?: readonly Period<number>[]
  /** Adding: the flat's tenancies, newest first, for the previous one. */
  tenancies?: readonly Tenancy[]
  /** Adding: today in Finland. */
  today?: IsoDate
  onSaved: () => Promise<void>
  onClose: () => void
  /** Correcting a tenancy that hasn't started: opens the removal dialog. */
  onRemove?: () => void
}

type Field =
  | 'tenantName'
  | 'tenantPhone'
  | 'tenantEmail'
  | 'contractMade'
  | 'validFrom'
  | 'termEnd'
  | 'rent'
  | 'dueDay'
  | 'noticeDate'
  | 'lastDay'

/** The field a server's reason belongs under; others are alerts. */
const FIELD_OF_TENANCY: Partial<Record<FieldReason, Field>> = {
  tenant_name_required: 'tenantName',
  tenant_name_too_long: 'tenantName',
  tenant_phone_too_long: 'tenantPhone',
  email_invalid: 'tenantEmail',
  tenancy_contract_made_in_future: 'contractMade',
  tenancy_overlaps: 'validFrom',
  tenancy_start_before_ownership: 'validFrom',
  tenancy_end_before_start: 'termEnd',
  tenancy_due_day_invalid: 'dueDay',
  amount_invalid: 'rent',
  amount_date_too_early: 'rent',
  amount_date_before_ownership: 'rent',
}

/**
 * The tenancy a new one follows, while it is still to end: the latest one
 * ending before the start entered, or before one is entered, the flat's
 * latest tenancy.
 */
export function previousTenancy(
  tenancies: readonly Tenancy[],
  start: IsoDate | undefined,
  today: IsoDate | undefined,
): Tenancy | undefined {
  const before =
    start === undefined
      ? tenancies[0]
      : tenancies.find((t) => t.validTo !== null && t.validTo < start)
  return before?.validTo != null &&
    today !== undefined &&
    before.validTo >= today
    ? before
    : undefined
}

const FIELD_OF: Partial<Record<FieldReason, Field>> = {
  ...FIELD_OF_TENANCY,
  ...Object.fromEntries<Field>([
    ...NOTICE_REASONS.map((reason): [string, Field] => [reason, 'noticeDate']),
    ...LAST_DAY_REASONS.map((reason): [string, Field] => [reason, 'lastDay']),
  ]),
}

function CloseIcon() {
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
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <Stack component="section" sx={{ gap: 1.25 }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 900 }}>
        {props.title}
      </Typography>
      {props.children}
    </Stack>
  )
}

const pair = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 1.25,
} as const

export function TenancyForm(props: Props) {
  const { editing, rents = [] } = props
  const [alert, setAlert] = useState<AlertReason>()
  const [reasons, setReasons] = useState<Partial<Record<Field, FieldReason>>>(
    {},
  )
  // Contract made and the rent follow the start until the user edits them.
  const madeEditedRef = useRef(editing !== undefined)
  const rentEditedRef = useRef(false)
  // An earlier tenancy's ending (adding only, a start before today).
  const [ended, setEnded] = useState(false)
  const [by, setBy] = useState<NoticeGiver>('tenant')
  const lastDayEditedRef = useRef(false)

  const form = useForm({
    defaultValues: {
      tenantName: editing?.tenantName ?? '',
      tenantPhone: editing?.tenantPhone ?? '',
      tenantEmail: editing?.tenantEmail ?? '',
      contractType: editing?.contractType ?? 'open_ended',
      contractMade: editing ? formatDate(editing.contractMade) : '',
      validFrom: editing ? formatDate(editing.validFrom) : '',
      termEnd: editing?.termEnd ? formatDate(editing.termEnd) : '',
      rent: '',
      dueDay: editing ? String(editing.dueDay) : '',
      noticeDate: '',
      lastDay: '',
    },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setReasons({})
      const { rent, noticeDate, lastDay, ...fields } = value
      const start = parseFiDate(fields.validFrom)
      // As the form shows them: the rent from the latest rent period on, the
      // ending for a start before today.
      const askRent = start === undefined || rentAsked(rents, start)
      const withEnding =
        ended && start !== undefined && start < (props.today ?? start)
      try {
        const result = editing
          ? await updateTenancy({
              data: {
                propertyId: props.propertyId,
                tenancyId: editing.id,
                ...fields,
              },
            })
          : await createTenancy({
              data: {
                propertyId: props.propertyId,
                ...fields,
                ...(askRent ? { rent } : {}),
                ...(withEnding
                  ? {
                      ending: {
                        noticeGivenBy: waysFor(fields.contractType).includes(by)
                          ? by
                          : waysFor(fields.contractType)[0],
                        noticeDate,
                        lastDay,
                      },
                    }
                  : {}),
              },
            })
        if (result.ok) {
          await props.onSaved()
          return
        }
        const field = FIELD_OF[result.reason as FieldReason]
        if (field) {
          setReasons({ [field]: result.reason as FieldReason })
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('tenancy.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const contractType = useSelector(form.store, (s) => s.values.contractType)
  const start = useSelector(form.store, (s) => parseFiDate(s.values.validFrom))
  const previous = previousTenancy(props.tenancies ?? [], start, props.today)
  const contractMade = useSelector(form.store, (s) =>
    parseFiDate(s.values.contractMade),
  )
  const termEnd = useSelector(form.store, (s) => parseFiDate(s.values.termEnd))
  const noticeDate = useSelector(form.store, (s) =>
    parseFiDate(s.values.noticeDate),
  )
  const askRent =
    editing === undefined && (start === undefined || rentAsked(rents, start))
  const canEnd =
    editing === undefined &&
    start !== undefined &&
    props.today !== undefined &&
    start < props.today
  // The tenancy as entered, for the suggested last day and the hint.
  const entered =
    start === undefined
      ? undefined
      : {
          contractType,
          contractMade: contractMade ?? start,
          validFrom: start,
          termEnd: contractType === 'fixed_term' ? (termEnd ?? null) : null,
        }
  const suggest = (way: NoticeGiver, notice: IsoDate | undefined) => {
    if (!lastDayEditedRef.current && entered) {
      form.setFieldValue('lastDay', suggestedLastDay(way, entered, notice))
    }
  }
  const way = waysFor(contractType).includes(by) ? by : waysFor(contractType)[0]
  const clear = (field: Field) => () => {
    setReasons((current) => ({ ...current, [field]: undefined }))
  }

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="tenancy-form-title"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      sx={{ minHeight: '100dvh' }}
    >
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
        <IconButton aria-label={m.amounts_form_close()} onClick={props.onClose}>
          <CloseIcon />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            id="tenancy-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {editing ? m.tenancy_form_edit_title() : m.tenancy_form_new_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 2.25, px: 2.5, pt: 1.25, pb: 2.5 }}
      >
        {previous?.validTo ? (
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: `1.5px dashed ${colors.dashed}`,
              borderRadius: `${String(radii.card)}px`,
              px: 2,
              py: 1.5,
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            {m.tenancy_form_previous({
              name: previous.tenantName,
              date: formatDate(previous.validTo),
            })}
          </Box>
        ) : null}
        <Section title={m.tenancy_form_tenant()}>
          <form.Field
            name="tenantName"
            validators={{ onChange: typedTenantName }}
            listeners={{ onChange: clear('tenantName') }}
          >
            {(field) => (
              <TextField
                field={field}
                reason={reasons.tenantName}
                label={m.tenancy_form_name()}
                autoComplete="off"
              />
            )}
          </form.Field>
          <Box sx={pair}>
            <form.Field
              name="tenantPhone"
              validators={{ onChange: typedTenantPhone }}
              listeners={{ onChange: clear('tenantPhone') }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.tenantPhone}
                  label={m.tenancy_form_phone()}
                  type="tel"
                  autoComplete="off"
                />
              )}
            </form.Field>
            <form.Field
              name="tenantEmail"
              validators={{ onChange: typedTenantEmail }}
              listeners={{ onChange: clear('tenantEmail') }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.tenantEmail}
                  label={m.tenancy_form_email()}
                  type="email"
                  autoComplete="off"
                />
              )}
            </form.Field>
          </Box>
        </Section>
        <Section title={m.tenancy_contract()}>
          <form.Field name="contractType">
            {(field) => (
              <ChoiceField
                field={field}
                label={m.tenancy_form_contract_type()}
                choices={(['open_ended', 'fixed_term'] as const).map(
                  (value) => ({
                    value,
                    label: contractShortLabel[value](),
                  }),
                )}
              />
            )}
          </form.Field>
          <form.Field
            name="validFrom"
            validators={{ onChange: typedDate }}
            listeners={{
              onChange: ({ value }) => {
                clear('validFrom')()
                if (!madeEditedRef.current) {
                  form.setFieldValue('contractMade', value)
                }
                const start = parseFiDate(value)
                if (!editing && !rentEditedRef.current && start !== undefined) {
                  const rent = periodOn(rents, start)?.value
                  form.setFieldValue(
                    'rent',
                    rent === undefined ? '' : formatAmountInput(rent),
                  )
                }
              },
            }}
          >
            {(field) => (
              <TextField
                field={field}
                reason={reasons.validFrom}
                label={m.tenancy_form_start()}
                placeholder={m.date_placeholder()}
              />
            )}
          </form.Field>
          {contractType === 'fixed_term' ? (
            <form.Field
              name="termEnd"
              validators={{
                onChange: ({ value }) =>
                  parseFiDate(value) === undefined
                    ? ('tenancy_end_before_start' satisfies FieldReason)
                    : undefined,
              }}
              listeners={{ onChange: clear('termEnd') }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.termEnd}
                  label={m.tenancy_form_term_end()}
                  placeholder={m.date_placeholder()}
                />
              )}
            </form.Field>
          ) : null}
          <form.Field
            name="contractMade"
            validators={{ onChange: typedDate }}
            listeners={{
              onChange: () => {
                clear('contractMade')()
              },
              onBlur: () => {
                madeEditedRef.current = true
              },
            }}
          >
            {(field) => (
              <TextField
                field={field}
                reason={reasons.contractMade}
                label={m.tenancy_contract_made()}
                placeholder={m.date_placeholder()}
                onFocus={() => {
                  madeEditedRef.current = true
                }}
              />
            )}
          </form.Field>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -0.75 }}>
            {m.tenancy_form_made_hint()}
          </Typography>
          <Box sx={pair}>
            {askRent ? (
              <form.Field
                name="rent"
                validators={{ onChange: typedAmount }}
                listeners={{
                  onChange: () => {
                    clear('rent')()
                  },
                }}
              >
                {(field) => (
                  <TextField
                    field={field}
                    reason={reasons.rent}
                    label={m.tenancy_form_rent()}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                    onFocus={() => {
                      rentEditedRef.current = true
                    }}
                  />
                )}
              </form.Field>
            ) : null}
            <form.Field
              name="dueDay"
              validators={{ onChange: typedDueDay }}
              listeners={{ onChange: clear('dueDay') }}
            >
              {(field) => (
                <TextField
                  field={field}
                  reason={reasons.dueDay}
                  label={m.tenancy_due_day()}
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                />
              )}
            </form.Field>
          </Box>
          {editing ? null : (
            <Typography variant="body2" color="text.secondary">
              {askRent
                ? m.tenancy_form_rent_hint()
                : m.tenancy_form_rent_not_asked()}
            </Typography>
          )}
        </Section>
        {canEnd && entered ? (
          <Section title={m.tenancy_form_ending()}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={ended}
                  onChange={(e) => {
                    setEnded(e.target.checked)
                    if (e.target.checked) {
                      suggest(way, noticeDate)
                    }
                  }}
                />
              }
              label={m.tenancy_form_ended()}
              sx={{ minHeight: 44 }}
            />
            {ended ? (
              <>
                <EndingWayPicker
                  id="tenancy-ending-way"
                  contractType={contractType}
                  value={way}
                  onChange={(chosen) => {
                    setBy(chosen)
                    clear('lastDay')()
                    suggest(chosen, noticeDate)
                  }}
                />
                <Box sx={pair}>
                  <form.Field
                    name="noticeDate"
                    validators={{ onChange: typedDate }}
                    listeners={{
                      onChange: ({ value }) => {
                        clear('noticeDate')()
                        suggest(way, parseFiDate(value))
                      },
                    }}
                  >
                    {(field) => (
                      <TextField
                        field={field}
                        reason={reasons.noticeDate}
                        label={noticeDateLabel(way)}
                        placeholder={m.date_placeholder()}
                      />
                    )}
                  </form.Field>
                  <form.Field
                    name="lastDay"
                    validators={{ onChange: typedDate }}
                    listeners={{ onChange: clear('lastDay') }}
                  >
                    {(field) => (
                      <TextField
                        field={field}
                        reason={reasons.lastDay}
                        label={m.tenancy_last_day()}
                        placeholder={m.date_placeholder()}
                        onFocus={() => {
                          lastDayEditedRef.current = true
                        }}
                      />
                    )}
                  </form.Field>
                </Box>
                <EndingHint text={hintFor(way, entered, noticeDate)} />
              </>
            ) : null}
          </Section>
        ) : null}
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
        {editing && props.onRemove ? (
          <Button
            variant="text"
            color="error"
            onClick={props.onRemove}
            sx={{ alignSelf: 'center', minHeight: 44 }}
          >
            {m.tenancy_remove()}
          </Button>
        ) : null}
      </Stack>
      <Box
        component="footer"
        sx={{
          px: 2.5,
          pt: 1.5,
          pb: 3.5,
          borderTop: `1px solid ${colors.cardBorder}`,
        }}
      >
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button
              type="submit"
              fullWidth
              loading={submitting}
              loadingPosition="start"
              sx={{ minHeight: 56 }}
            >
              {editing ? m.tenancy_form_save_edit() : m.tenancy_form_save_new()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
    </Stack>
  )
}
