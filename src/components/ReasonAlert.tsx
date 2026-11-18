// An error about the whole action (src/lib/reasons.ts, AlertReason), with
// its title, as on the Design canvas (SignInErrors). role="alert" makes
// screen readers announce it.
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import { reasonText, type Reason } from '#/lib/reasons'
import { errorReference } from '#/lib/trace'
import { m } from '#/paraglide/messages.js'

/**
 * `unexpected` also shows the error reference (spec: "Showing a reference
 * with an unexpected error"), which finds the failure in the logs.
 */
export function ReasonAlert({ reason }: { reason: Reason }) {
  const { title, text } = reasonText(reason)
  const reference = reason === 'unexpected' ? errorReference() : undefined
  return (
    <Alert severity="error">
      {title === undefined ? null : <AlertTitle>{title}</AlertTitle>}
      {text}
      {reference === undefined ? null : (
        <Box
          component="span"
          sx={{
            display: 'block',
            mt: 0.5,
            color: 'text.secondary',
            fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
          }}
        >
          {m.error_reference({ reference })}
        </Box>
      )}
    </Alert>
  )
}
