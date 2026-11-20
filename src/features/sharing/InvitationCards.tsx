// Pending flat invitations on the flats list (Design canvas: AsunnotKutsu):
// who shared which flat, with Accept and Decline (spec: "Accepting a flat
// invitation", "Declining a flat invitation").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { LogoMark } from '#/components/Logo'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { formatDay } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { acceptInvitation, declineInvitation } from './functions'
import type { ReceivedInvitation } from './sharing.repository.server'

interface Props {
  invitations: readonly ReceivedInvitation[]
  /** Reloads the list (and the invitations) after an answer. */
  onAnswered: () => Promise<void>
}

export function InvitationCards({ invitations, onAnswered }: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  /** The invitation being answered, and how. */
  const [busy, setBusy] = useState<{ id: string; accept: boolean }>()
  const [notice, setNotice] = useState<string>()

  async function answer(invitation: ReceivedInvitation, accept: boolean) {
    setAlert(undefined)
    setBusy({ id: invitation.id, accept })
    try {
      const data = { invitationId: invitation.id }
      const result = accept
        ? await acceptInvitation({ data })
        : await declineInvitation({ data })
      if (result.ok) {
        await onAnswered()
        setNotice(
          accept
            ? m.invitation_accepted({ address: invitation.streetAddress })
            : m.invitation_declined(),
        )
      } else {
        setAlert(result.reason)
        // A cancelled or expired invitation disappears with the reload.
        await onAnswered()
      }
    } catch (error) {
      clientLog.error('sharing.answer_failed', { accept }, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <>
      {alert === undefined ? null : <ReasonAlert reason={alert} />}
      {invitations.length === 0 ? null : (
        <Stack
          component="ul"
          aria-label={m.invitations_label()}
          sx={{ gap: 1.25, m: 0, p: 0, listStyle: 'none' }}
        >
          {invitations.map((invitation) => (
            <Stack
              component="li"
              key={invitation.id}
              sx={{
                gap: 1.5,
                p: 1.75,
                bgcolor: colors.yellowTint,
                border: `1.5px solid ${colors.yellowBorder}`,
                borderRadius: `${String(radii.card)}px`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 56,
                    height: 56,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '18px',
                    bgcolor: 'background.paper',
                  }}
                >
                  <LogoMark size={34} />
                </Box>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography variant="body2" component="span">
                    {m.invitation_from({ inviter: invitation.inviterName })}
                  </Typography>
                  <Typography variant="subtitle1" component="span">
                    {invitation.streetAddress}
                  </Typography>
                  <Typography variant="body2" component="span">
                    {m.invitation_details({
                      city: invitation.city,
                      expires: formatDay(invitation.expiresAt),
                    })}
                  </Typography>
                </Stack>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  loading={busy?.id === invitation.id && busy.accept}
                  disabled={busy !== undefined}
                  onClick={() => {
                    void answer(invitation, true)
                  }}
                >
                  {m.invitation_accept()}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="inherit"
                  loading={busy?.id === invitation.id && !busy.accept}
                  disabled={busy !== undefined}
                  onClick={() => {
                    void answer(invitation, false)
                  }}
                  sx={{ bgcolor: 'background.paper' }}
                >
                  {m.invitation_decline()}
                </Button>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
      <Snackbar
        open={notice !== undefined}
        autoHideDuration={5000}
        onClose={() => {
          setNotice(undefined)
        }}
        message={notice}
        slotProps={{
          content: {
            sx: { bgcolor: 'primary.main', color: 'primary.contrastText' },
          },
        }}
      />
    </>
  )
}
