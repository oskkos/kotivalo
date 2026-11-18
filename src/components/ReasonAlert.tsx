// An error about the whole action (src/lib/reasons.ts, AlertReason), with
// its title, as on the Design canvas (SignInErrors). role="alert" makes
// screen readers announce it.
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { reasonText, type Reason } from '#/lib/reasons'

export function ReasonAlert({ reason }: { reason: Reason }) {
  const { title, text } = reasonText(reason)
  return (
    <Alert severity="error">
      {title === undefined ? null : <AlertTitle>{title}</AlertTitle>}
      {text}
    </Alert>
  )
}
