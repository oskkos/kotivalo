// The parts of recording an ending shared by the end form and the new tenant
// form (an earlier tenancy's ending): the ways of ending, their labels, the
// reasons under each date and the hint for the chosen way (openspec:
// tenancies, "Ending a tenancy", "Adding a tenant"). Each form keeps its own
// date fields.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { IsoDate } from '#/lib/dates'
import { formatDate } from '#/lib/format'
import type { FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import type { ContractType, NoticeGiver } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import {
  earliestLastDay,
  noticePeriodMonths,
  type NoticeTenancy,
} from './notice'

const OPEN_WAYS = ['tenant', 'landlord', 'agreed', 'other'] as const
const FIXED_WAYS = ['agreed', 'court', 'other'] as const

/** The ways a tenancy of this type can end; a fixed term not by notice. */
export function waysFor(contractType: ContractType): readonly NoticeGiver[] {
  return contractType === 'fixed_term' ? FIXED_WAYS : OPEN_WAYS
}

const wayLabel: Record<NoticeGiver, () => string> = {
  tenant: () => m.tenancy_end_by_tenant(),
  landlord: () => m.tenancy_end_by_landlord(),
  agreed: () => m.tenancy_by_agreed(),
  court: () => m.tenancy_by_court(),
  other: () => m.tenancy_by_other(),
}

/** Reasons shown under the notice date. */
export const NOTICE_REASONS: readonly FieldReason[] = [
  'date_invalid',
  'tenancy_notice_in_future',
  'tenancy_notice_before_start',
]

/** Reasons shown under the last day. */
export const LAST_DAY_REASONS: readonly FieldReason[] = [
  'tenancy_end_before_notice',
  'tenancy_end_before_notice_period',
  'tenancy_end_after_term',
  'tenancy_fixed_term_notice',
]

/** The notice date's label for the chosen way. */
export function noticeDateLabel(by: NoticeGiver): string {
  return by === 'tenant' || by === 'landlord'
    ? m.tenancy_end_notice_date()
    : by === 'other'
      ? m.tenancy_end_other_date()
      : m.tenancy_end_decided()
}

/** The suggested last day: the earliest legal one, or none for a fixed term. */
export function suggestedLastDay(
  by: NoticeGiver,
  tenancy: NoticeTenancy,
  noticeDate: IsoDate | undefined,
): string {
  return tenancy.contractType === 'fixed_term' || noticeDate === undefined
    ? ''
    : formatDate(earliestLastDay(by, tenancy, noticeDate))
}

/** The hint under the dates for the chosen way of ending. */
export function hintFor(
  by: NoticeGiver,
  tenancy: NoticeTenancy,
  noticeDate: IsoDate | undefined,
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

/** Who gave notice, or on what ground a fixed term ended early. */
export function EndingWayPicker(props: {
  id: string
  contractType: ContractType
  value: NoticeGiver
  onChange: (way: NoticeGiver) => void
}) {
  const fixed = props.contractType === 'fixed_term'
  return (
    <Stack role="group" aria-labelledby={props.id} sx={{ gap: 0.75 }}>
      <Typography
        id={props.id}
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
        {waysFor(props.contractType).map((way) => (
          <Button
            key={way}
            type="button"
            aria-pressed={props.value === way}
            onClick={() => {
              props.onChange(way)
            }}
            variant={props.value === way ? 'contained' : 'outlined'}
            color={props.value === way ? 'accent' : 'inherit'}
            sx={{ minHeight: 44, borderRadius: 999, px: 1 }}
          >
            {wayLabel[way]()}
          </Button>
        ))}
      </Box>
    </Stack>
  )
}

/** The hint box for the chosen way, announced as it changes. */
export function EndingHint(props: { text: string }) {
  return (
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
      {props.text}
    </Box>
  )
}
