// The reminder at the top of the Tenancy page for a deposit not returned
// after the tenancy's last rent day (openspec: deposits, "The deposit return
// reminder"): who, how much, and the legal deadline. Owners get the action.
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import type { IsoDate } from '#/lib/dates'
import { formatDate, formatMoney } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { returnDeadline } from './deposit'

interface Props {
  tenantName: string
  /** Cents. */
  deposit: number
  lastRentDay: IsoDate
  /** Owners only: opens the return page. */
  action?: ReactNode
}

export function PendingReturnCard(props: Props) {
  const id = `pending-${props.lastRentDay}-${props.tenantName.replace(/\W+/g, '-')}`
  return (
    <Stack
      component="section"
      aria-labelledby={id}
      sx={{
        bgcolor: colors.yellowTint,
        borderRadius: `${String(radii.card)}px`,
        gap: 0.75,
        px: 2,
        py: 1.75,
      }}
    >
      <Typography id={id} component="h2" sx={{ fontSize: 15, fontWeight: 900 }}>
        {m.deposit_pending_title()}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 800 }}>
        {m.deposit_pending_text({
          name: props.tenantName,
          amount: formatMoney(props.deposit),
          date: formatDate(props.lastRentDay),
        })}
      </Typography>
      <Typography variant="body2">
        {m.deposit_pending_deadline({
          date: formatDate(returnDeadline(props.lastRentDay)),
        })}
      </Typography>
      {props.action}
    </Stack>
  )
}
