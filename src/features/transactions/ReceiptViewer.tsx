// A receipt image full screen (Design canvas: "Kuitti koko näytöllä"), with
// Close and Download. PDFs open in the browser's own viewer instead.
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { m } from '#/paraglide/messages.js'
import { colors } from '#/theme/tokens'
import { receiptUrl } from './labels'
import type { Receipt } from './transaction.repository.server'

interface Props {
  receipt: Receipt
  open: boolean
  onClose: () => void
}

export function ReceiptViewer(props: Props) {
  return (
    <Dialog
      fullScreen
      open={props.open}
      onClose={props.onClose}
      slotProps={{
        paper: {
          'aria-label': m.transactions_receipt(),
          sx: { bgcolor: colors.plum, color: colors.cream },
        },
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          pt: 2,
          pb: 1,
        }}
      >
        <IconButton
          aria-label={m.transactions_close()}
          onClick={props.onClose}
          sx={{ color: 'inherit' }}
        >
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
        </IconButton>
        <Typography
          noWrap
          sx={{ fontSize: 14, fontWeight: 800, minWidth: 0, px: 1 }}
        >
          {props.receipt.filename}
        </Typography>
        <IconButton
          component="a"
          href={receiptUrl(props.receipt.id, true)}
          aria-label={m.transactions_download()}
          sx={{ color: 'inherit' }}
        >
          <svg
            width="22"
            height="22"
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
        </IconButton>
      </Stack>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          overflow: 'auto',
        }}
      >
        <Box
          component="img"
          src={receiptUrl(props.receipt.id)}
          alt={m.transactions_receipt_alt({ name: props.receipt.filename })}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            bgcolor: colors.white,
          }}
        />
      </Box>
    </Dialog>
  )
}
