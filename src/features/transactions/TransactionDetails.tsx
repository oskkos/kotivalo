// An entry's details (Design canvas: "Menon tiedot", "Tulon tiedot · ei
// kuittia", "Kirjauksen tiedot · jäsen"): the signed amount, category,
// deductibility, flat, date, the year summary row, who logged it and the
// receipt (openspec: transactions, "Entry details").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState, type ReactNode } from 'react'
import type { Property } from '#/features/properties/property'
import { formatDate, formatDay, formatFileSize } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { PropertyRole } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { CATEGORIES } from './categories'
import { categoryLabel, receiptUrl, summaryRowLabel } from './labels'
import { ReceiptViewer } from './ReceiptViewer'
import type { TransactionDetails as Entry } from './transaction.repository.server'
import { signedAmount } from './TransactionsPage'

interface Props {
  entry: Entry
  property: Property
  role: PropertyRole
  /** Whether the signed-in user logged it, shown as "You". */
  loggedByYou: boolean
  onBack: () => void
  /** The edit button, for owners. */
  editAction?: ReactNode
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

function Row(props: { label: string; value: string; first?: boolean }) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        minHeight: 46,
        borderTop: props.first ? 'none' : `1px solid ${colors.divider}`,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: 'text.secondary' }}
      >
        {props.label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 800, textAlign: 'right' }}>
        {props.value}
      </Typography>
    </Stack>
  )
}

function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19" />
    </svg>
  )
}

export function TransactionDetails(props: Props) {
  const { entry } = props
  const [viewing, setViewing] = useState(false)
  const income = entry.type === 'income'
  const { row } = CATEGORIES[entry.category]
  const treatment = income
    ? m.transactions_taxable()
    : row
      ? m.transactions_deductible()
      : m.transactions_not_deducted()
  const receipt = entry.receipt
  const isPdf = receipt?.contentType === 'application/pdf'
  const author = props.loggedByYou ? m.sharing_you() : entry.createdBy.name
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
        <IconButton aria-label={m.transactions_back()} onClick={props.onBack}>
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
        </IconButton>
        <Typography
          variant="h3"
          component="h1"
          sx={{ fontSize: 18, textAlign: 'center' }}
        >
          {income
            ? m.transactions_income_title()
            : m.transactions_expense_title()}
        </Typography>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 0.5, pb: 3 }}
      >
        <Stack
          sx={{
            alignItems: 'center',
            gap: 0.75,
            textAlign: 'center',
            pt: 0.75,
          }}
        >
          <Typography
            sx={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            {signedAmount(entry)}
          </Typography>
          {entry.note ? (
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>
              {entry.note}
            </Typography>
          ) : null}
          <Stack
            direction="row"
            sx={{ gap: 0.75, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <Box
              sx={{
                bgcolor: colors.plum,
                color: colors.cream,
                borderRadius: 999,
                px: 1.5,
                py: 0.5,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {categoryLabel[entry.category]()}
            </Box>
            <Box
              sx={{
                bgcolor: colors.yellowTint,
                borderRadius: 999,
                px: 1.5,
                py: 0.5,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {treatment}
            </Box>
          </Stack>
        </Stack>
        <Box sx={{ ...card, px: 2 }}>
          <Row
            first
            label={m.transactions_flat()}
            value={props.property.streetAddress}
          />
          <Row label={m.transactions_date()} value={formatDate(entry.date)} />
          {row && (
            <Row
              label={m.transactions_summary_row()}
              value={m.transactions_summary_row_value({
                year: entry.date.slice(0, 4),
                row: summaryRowLabel[row](),
              })}
            />
          )}
          <Row
            label={m.transactions_logged_by()}
            value={m.transactions_logged_by_value({
              name: author,
              date: formatDay(entry.createdAt),
            })}
          />
        </Box>
        <Stack
          component="section"
          aria-labelledby="receipt-heading"
          sx={{ gap: 1 }}
        >
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              id="receipt-heading"
              variant="h3"
              component="h2"
              sx={{ fontSize: 15 }}
            >
              {m.transactions_receipt()}
            </Typography>
            {receipt ? (
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ minWidth: 0 }}
              >
                {m.transactions_receipt_meta({
                  name: receipt.filename,
                  size: formatFileSize(receipt.size),
                })}
              </Typography>
            ) : null}
          </Stack>
          {!receipt ? (
            <Box
              sx={{
                ...card,
                borderRadius: `${String(radii.tile)}px`,
                px: 2,
                py: 1.75,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {m.transactions_no_receipt()}
              </Typography>
            </Box>
          ) : isPdf ? (
            <Button
              variant="outlined"
              href={receiptUrl(receipt.id)}
              target="_blank"
              rel="noopener"
              sx={{ minHeight: 64, borderRadius: `${String(radii.tile)}px` }}
            >
              {m.transactions_open_pdf()}
            </Button>
          ) : (
            <ButtonBase
              aria-label={m.transactions_open_receipt()}
              onClick={() => {
                setViewing(true)
              }}
              sx={{
                height: 214,
                borderRadius: `${String(radii.card)}px`,
                bgcolor: colors.sand,
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src={receiptUrl(receipt.id)}
                alt=""
                sx={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
            </ButtonBase>
          )}
        </Stack>
        <Box
          sx={{
            mt: 'auto',
            display: 'grid',
            gridTemplateColumns:
              receipt && props.editAction ? '1fr 1fr' : '1fr',
            gap: 1.25,
          }}
        >
          {receipt ? (
            <Button
              variant="outlined"
              href={receiptUrl(receipt.id, true)}
              startIcon={<DownloadIcon />}
              sx={{ minHeight: 52, borderRadius: 999 }}
            >
              {m.transactions_download()}
            </Button>
          ) : null}
          {props.role === 'owner' ? props.editAction : null}
        </Box>
      </Stack>
      {receipt && !isPdf ? (
        <ReceiptViewer
          receipt={receipt}
          open={viewing}
          onClose={() => {
            setViewing(false)
          }}
        />
      ) : null}
    </Stack>
  )
}
