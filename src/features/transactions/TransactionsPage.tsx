// A flat's Entries page (Design canvas: Kirjaukset): one year's entries by
// month, newest first, with the year's income and expenses (openspec:
// transactions, "The entries page"). Owners get New entry.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import {
  formatDayMonth,
  formatMoney,
  formatMoneyChange,
  formatMonth,
} from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { categoryLabel } from './labels'
import type { TransactionRow } from './transaction.repository.server'
import type { TransactionsView } from './transactions.server'

interface Props {
  view: TransactionsView
  onBack: () => void
  onYear: (year: number) => void
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

/** The amount with its sign: income +, expense −. */
export function signedAmount(entry: Pick<TransactionRow, 'type' | 'amount'>) {
  return formatMoneyChange(
    entry.type === 'income' ? entry.amount : -entry.amount,
  )
}

/** The entries grouped by month, keeping their order (newest first). */
export function byMonth(entries: readonly TransactionRow[]) {
  const months: {
    key: string
    year: number
    month: number
    entries: TransactionRow[]
  }[] = []
  for (const entry of entries) {
    const key = entry.date.slice(0, 7)
    let group = months.at(-1)
    if (group?.key !== key) {
      group = {
        key,
        year: Number(key.slice(0, 4)),
        month: Number(key.slice(5, 7)),
        entries: [],
      }
      months.push(group)
    }
    group.entries.push(entry)
  }
  return months
}

function Icon(props: { path: string; size?: number; label?: string }) {
  const size = props.size ?? 24
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(props.label
        ? { role: 'img', 'aria-label': props.label }
        : { 'aria-hidden': true })}
    >
      <path d={props.path} />
    </svg>
  )
}

const TextLink = createLink(Link)
const RowLink = createLink(Link)

const BACK = 'M15 5 L8 12 L15 19'
const UP = 'M7 17 L17 7 M9 7 H17 V15'
const DOWN = 'M17 7 L7 17 M7 9 V17 H15'
const CLIP =
  'M20 11.5 L12.5 19 a5 5 0 0 1 -7 -7 L13 4.5 a3.5 3.5 0 0 1 5 5 L10.5 17 a2 2 0 0 1 -3 -3 L14.5 7'

function Total(props: { label: string; amount: string }) {
  return (
    <Stack sx={{ ...card, borderRadius: '18px', px: 1.75, py: 1.5, gap: 0.25 }}>
      <Typography
        variant="body2"
        sx={{ fontWeight: 800, color: 'text.secondary' }}
      >
        {props.label}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
        {props.amount}
      </Typography>
    </Stack>
  )
}

function EntryRow(props: {
  entry: TransactionRow
  propertyId: string
  first: boolean
}) {
  const { entry } = props
  const income = entry.type === 'income'
  const details = [formatDayMonth(entry.date), entry.note]
    .filter(Boolean)
    .join(' · ')
  return (
    <Box
      component="li"
      sx={{ borderTop: props.first ? 'none' : `1px solid ${colors.divider}` }}
    >
      <RowLink
        to="/properties/$propertyId/transactions/$transactionId"
        params={{ propertyId: props.propertyId, transactionId: entry.id }}
        underline="none"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 64,
          px: 1.75,
          py: 1,
          color: 'text.primary',
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '19px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: income ? colors.lavenderTint : colors.yellowTint,
          }}
        >
          <Icon path={income ? DOWN : UP} size={18} />
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 900 }}>
            {categoryLabel[entry.category]()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {details}
          </Typography>
        </Stack>
        {entry.hasReceipt ? (
          <Box sx={{ color: 'text.secondary', display: 'flex' }}>
            <Icon path={CLIP} size={18} label={m.transactions_has_receipt()} />
          </Box>
        ) : null}
        <Typography
          sx={{ fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap' }}
        >
          {signedAmount(entry)}
        </Typography>
      </RowLink>
    </Box>
  )
}

export function TransactionsPage(props: Props) {
  const { view } = props
  const isOwner = view.role === 'owner'
  const months = byMonth(view.entries)
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
          <Icon path={BACK} />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 18 }}>
            {m.transactions_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {view.property.streetAddress}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.5, px: 2.5, pt: 1.25, pb: 3 }}
      >
        <Stack
          role="group"
          aria-label={m.transactions_year()}
          direction="row"
          sx={{ gap: 1, flexWrap: 'wrap' }}
        >
          {view.years.map((year) => {
            const pressed = year === view.year
            return (
              <Button
                key={year}
                variant={pressed ? 'contained' : 'outlined'}
                aria-pressed={pressed}
                onClick={() => {
                  props.onYear(year)
                }}
                sx={{ borderRadius: 999, minHeight: 44, px: 2.25 }}
              >
                {String(year)}
              </Button>
            )
          })}
        </Stack>
        <Box
          component="section"
          aria-label={m.transactions_totals()}
          sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}
        >
          <Total
            label={m.transactions_income()}
            amount={formatMoneyChange(view.totals.income)}
          />
          <Total
            label={m.transactions_expenses()}
            amount={
              view.totals.expense === 0
                ? formatMoney(0)
                : formatMoneyChange(-view.totals.expense)
            }
          />
        </Box>
        <Box
          sx={{
            bgcolor: colors.lavenderTint,
            borderRadius: `${String(radii.tile)}px`,
            px: 1.75,
            py: 1.5,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {m.transactions_computed_note()}{' '}
          <TextLink
            to="/properties/$propertyId/amounts"
            params={{ propertyId: view.property.id }}
            sx={{ fontWeight: 900 }}
          >
            {m.amounts_title()}
          </TextLink>
        </Box>
        {months.length === 0 ? (
          <Stack
            component="section"
            sx={{
              ...card,
              px: 2.5,
              py: 3,
              gap: 1.25,
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <Typography variant="h3" component="h2" sx={{ fontSize: 17 }}>
              {m.transactions_empty_title({ year: String(view.year) })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {m.transactions_empty_text()}
            </Typography>
          </Stack>
        ) : (
          months.map((group) => {
            const heading = formatMonth(group.year, group.month)
            return (
              <Stack
                key={group.key}
                component="section"
                aria-label={heading}
                sx={{ gap: 0.75 }}
              >
                <Typography
                  variant="h3"
                  component="h2"
                  sx={{ fontSize: 15, mt: 0.5 }}
                >
                  {heading}
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    ...card,
                    m: 0,
                    p: 0,
                    listStyle: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {group.entries.map((entry, i) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      propertyId={view.property.id}
                      first={i === 0}
                    />
                  ))}
                </Box>
              </Stack>
            )
          })
        )}
        {isOwner ? null : (
          <Typography variant="body2" color="text.secondary">
            {m.transactions_member_note()}
          </Typography>
        )}
      </Stack>
    </Stack>
  )
}
