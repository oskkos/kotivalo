// Ending a tenancy (Design canvas: Päätä vuokrasuhde, Päätä määräaikainen
// vuokrasuhde): who gave notice or on what ground, the date, and the last
// day, which follows the earliest legal date until edited, with the hint
// for each case (openspec: tenancies, "Ending a tenancy", "Ending a
// fixed-term tenancy early"; CONCEPT.md §4.2).
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useRef, useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { typedDate } from '#/features/ownership/schemas'
import { clientLog } from '#/lib/client-log'
import { parseFiDate } from '#/lib/dates'
import { formatDate } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import type { NoticeGiver } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { endTenancy } from './functions'
import { earliestLastDay, noticePeriodMonths } from './notice'
import type { Tenancy } from './tenancy.repository.server'

interface Props {
  propertyId: string
  address: string
  tenancy: Tenancy
  today: string
  onDone: () => Promise<void>
  onClose: () => void
}

const OPEN_WAYS = ['tenant', 'landlord', 'agreed', 'other'] as const
const FIXED_WAYS = ['agreed', 'court', 'other'] as const

const wayLabel: Record<NoticeGiver, () => string> = {
  tenant: () => m.tenancy_end_by_tenant(),
  landlord: () => m.tenancy_end_by_landlord(),
  agreed: () => m.tenancy_by_agreed(),
  court: () => m.tenancy_by_court(),
  other: () => m.tenancy_by_other(),
}

const NOTICE_REASONS: readonly FieldReason[] = [
  'date_invalid',
  'tenancy_notice_in_future',
  'tenancy_notice_before_start',
]
const LAST_DAY_REASONS: readonly FieldReason[] = [
  'tenancy_end_before_notice',
  'tenancy_end_before_notice_period',
  'tenancy_end_after_term',
  'tenancy_fixed_term_notice',
]

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

/** The hint under the dates for the chosen way of ending. */
function hintFor(
  by: NoticeGiver,
  tenancy: Tenancy,
  noticeDate: string | undefined,
): string {
  switch (by) {
    case 'tenant':
    case 'landlord': {
      const date = noticeDate ?? tenancy.validFrom
      const earliest = formatDate(earliestLastDay(by, tenancy, date))
      return by === 'tenant'
        ? m.tenancy_end_hint_tenant({ date: earliest })
        : m.tenancy_end_hint_landlord({
            made: formatDate(tenancy.contractMade),
            months: String(noticePeriodMonths(by, tenancy, date)),
            date: earliest,
          })
    }
    case 'agreed':
      return m.tenancy_end_hint_agreed()
    case 'court':
      return m.tenancy_end_hint_court()
    case 'other':
      return m.tenancy_end_hint_other()
  }
}

export function EndTenancyForm(props: Props) {
  const { tenancy, today } = props
  const fixed = tenancy.contractType === 'fixed_term'
  const ways = fixed ? FIXED_WAYS : OPEN_WAYS
  const [by, setBy] = useState<NoticeGiver>(ways[0])
  const [alert, setAlert] = useState<AlertReason>()
  const [noticeReason, setNoticeReason] = useState<FieldReason>()
  const [lastDayReason, setLastDayReason] = useState<FieldReason>()
  const lastDayEditedRef = useRef(false)

  const suggested = (way: NoticeGiver, notice: string) => {
    const date = parseFiDate(notice)
    return date === undefined
      ? ''
      : formatDate(earliestLastDay(way, tenancy, date))
  }

  const form = useForm({
    defaultValues: {
      noticeDate: formatDate(today),
      lastDay: fixed
        ? ''
        : formatDate(earliestLastDay(ways[0], tenancy, today)),
    },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setNoticeReason(undefined)
      setLastDayReason(undefined)
      try {
        const result = await endTenancy({
          data: {
            propertyId: props.propertyId,
            tenancyId: tenancy.id,
            noticeGivenBy: by,
            noticeDate: value.noticeDate,
            lastDay: value.lastDay,
          },
        })
        if (result.ok) {
          await props.onDone()
        } else if (NOTICE_REASONS.includes(result.reason as FieldReason)) {
          setNoticeReason(result.reason as FieldReason)
        } else if (LAST_DAY_REASONS.includes(result.reason as FieldReason)) {
          setLastDayReason(result.reason as FieldReason)
        } else {
          setAlert(result.reason as AlertReason)
        }
      } catch (error) {
        clientLog.error('tenancy.end_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const noticeText = useSelector(form.store, (s) => s.values.noticeDate)
  const notice = parseFiDate(noticeText)

  const choose = (way: NoticeGiver) => {
    setBy(way)
    setLastDayReason(undefined)
    if (!lastDayEditedRef.current && !fixed) {
      form.setFieldValue('lastDay', suggested(way, noticeText))
    }
  }

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="end-form-title"
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
            id="end-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18, textAlign: 'center' }}
          >
            {m.tenancy_end_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.address}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 2, px: 2.5, pt: 1.25, pb: 2.5 }}
      >
        <Typography sx={{ fontSize: 16, fontWeight: 900 }}>
          {tenancy.tenantName}
        </Typography>
        {fixed && tenancy.termEnd !== null ? (
          <Box
            sx={{
              bgcolor: colors.yellowTint,
              borderRadius: `${String(radii.input)}px`,
              px: 1.75,
              py: 1.5,
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            {m.tenancy_end_fixed_info({ date: formatDate(tenancy.termEnd) })}
          </Box>
        ) : null}
        <Stack role="group" aria-labelledby="end-way-label" sx={{ gap: 0.75 }}>
          <Typography
            id="end-way-label"
            variant="body2"
            component="span"
            sx={{ fontWeight: 800, color: 'text.secondary' }}
          >
            {fixed ? m.tenancy_end_ground() : m.tenancy_end_who()}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 0.75,
            }}
          >
            {ways.map((way) => (
              <Button
                key={way}
                type="button"
                aria-pressed={by === way}
                onClick={() => {
                  choose(way)
                }}
                variant={by === way ? 'contained' : 'outlined'}
                color={by === way ? 'accent' : 'inherit'}
                sx={{ minHeight: 44, borderRadius: 999, px: 1 }}
              >
                {wayLabel[way]()}
              </Button>
            ))}
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1.25,
          }}
        >
          <form.Field
            name="noticeDate"
            validators={{ onChange: typedDate }}
            listeners={{
              onChange: ({ value }) => {
                setNoticeReason(undefined)
                if (!lastDayEditedRef.current && !fixed) {
                  form.setFieldValue('lastDay', suggested(by, value))
                }
              },
            }}
          >
            {(field) => (
              <TextField
                field={field}
                reason={noticeReason}
                label={
                  by === 'tenant' || by === 'landlord'
                    ? m.tenancy_end_notice_date()
                    : by === 'other'
                      ? m.tenancy_end_other_date()
                      : m.tenancy_end_decided()
                }
                placeholder={m.date_placeholder()}
              />
            )}
          </form.Field>
          <form.Field
            name="lastDay"
            validators={{ onChange: typedDate }}
            listeners={{
              onChange: () => {
                setLastDayReason(undefined)
              },
            }}
          >
            {(field) => (
              <TextField
                field={field}
                reason={lastDayReason}
                label={m.tenancy_last_day()}
                placeholder={m.date_placeholder()}
                onFocus={() => {
                  lastDayEditedRef.current = true
                }}
              />
            )}
          </form.Field>
        </Box>
        <Box
          role="status"
          sx={{
            bgcolor: colors.yellowTint,
            borderRadius: `${String(radii.input)}px`,
            px: 1.75,
            py: 1.5,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          {hintFor(by, tenancy, notice)}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {m.tenancy_end_info()}
        </Typography>
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
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
              {m.tenancy_end_save()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
    </Stack>
  )
}
