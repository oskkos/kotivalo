// A flat's Sharing page (Design canvas: Jakaminen): who has access, pending
// invitations, the invite form for the owner and "Leave" for a member
// (openspec: sharing). Becomes "Ownership and sharing" with the shares.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm } from '@tanstack/react-form'
import { useState, type ReactNode } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import {
  emailSchema,
  requestCodeInput,
} from '#/features/authentication/schemas'
import { clientLog } from '#/lib/client-log'
import { formatDay } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import {
  cancelInvitation,
  inviteToProperty,
  leaveProperty,
  removeAccess,
} from './functions'
import type { SharingView } from './sharing.server'

interface Props {
  view: SharingView
  /** Reloads the view after a change. */
  onChanged: () => Promise<void>
  /** After leaving the flat, which is then gone from the user's list. */
  onLeft: () => void
  onBack: () => void
}

type Person = SharingView['people'][number]

type Confirm =
  { kind: 'remove'; person: Person } | { kind: 'leave' } | undefined

function BackIcon() {
  return (
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
  )
}

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7 L12 13 L21 7" />
    </svg>
  )
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

/** A row in a card: an icon, two lines of text and an optional action. */
function Row(props: {
  icon: ReactNode
  title: string
  meta: string
  action?: ReactNode
}) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 64,
        '& + &': { borderTop: `1px solid ${colors.divider}` },
      }}
    >
      {props.icon}
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          component="span"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {props.title}
        </Typography>
        <Typography variant="body2" component="span" color="text.secondary">
          {props.meta}
        </Typography>
      </Stack>
      {props.action}
    </Box>
  )
}

function Initial({ name, you }: { name: string; you: boolean }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 38,
        height: 38,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        bgcolor: you ? colors.yellow : colors.lavenderTint,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </Box>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <Stack component="section" sx={{ gap: 0.75 }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 900 }}>
        {props.title}
      </Typography>
      {props.children}
    </Stack>
  )
}

export function SharingPage({ view, onChanged, onLeft, onBack }: Props) {
  const isOwner = view.role === 'owner'
  const address = view.property.streetAddress
  const [alert, setAlert] = useState<AlertReason>()
  const [confirm, setConfirm] = useState<Confirm>()
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string>()

  /** Runs a change, then reloads; shows why it failed if it did. */
  async function change(
    event: string,
    action: () => Promise<{ ok: true } | { ok: false; reason: AlertReason }>,
    after: () => Promise<void> | void = onChanged,
  ) {
    setAlert(undefined)
    setBusy(true)
    try {
      const result = await action()
      if (result.ok) {
        await after()
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error(event, {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(false)
      setConfirm(undefined)
    }
  }

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
        <IconButton aria-label={m.sharing_back()} onClick={onBack}>
          <BackIcon />
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 18 }}>
            {m.sharing_title()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {address}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 2, px: 2.5, pt: 1.25, pb: 3 }}
      >
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
        <Section title={m.sharing_people()}>
          <Box component="ul" sx={{ ...card, listStyle: 'none', m: 0, px: 2 }}>
            {view.people.map((person) => {
              const name = person.isYou ? m.sharing_you() : person.name
              return (
                <Row
                  key={person.userId}
                  icon={<Initial name={name} you={person.isYou} />}
                  title={name}
                  meta={
                    person.role === 'owner'
                      ? m.sharing_role_owner()
                      : m.sharing_member_since({
                          date: formatDay(person.since),
                        })
                  }
                  action={
                    isOwner && person.role === 'member' ? (
                      <Button
                        variant="outlined"
                        color="inherit"
                        size="small"
                        aria-label={m.sharing_remove_label({ name })}
                        onClick={() => {
                          setConfirm({ kind: 'remove', person })
                        }}
                        sx={{ minHeight: 44, flexShrink: 0 }}
                      >
                        {m.sharing_remove()}
                      </Button>
                    ) : undefined
                  }
                />
              )
            })}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {isOwner ? m.sharing_owner_note() : m.sharing_member_note()}
          </Typography>
        </Section>
        {view.invitations.length === 0 ? null : (
          <Section title={m.sharing_pending()}>
            <Box
              component="ul"
              sx={{ ...card, listStyle: 'none', m: 0, px: 2 }}
            >
              {view.invitations.map((invitation) => (
                <Row
                  key={invitation.id}
                  icon={
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 38,
                        height: 38,
                        flexShrink: 0,
                        borderRadius: '50%',
                        border: `1.5px dashed ${colors.dashed}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MailIcon />
                    </Box>
                  }
                  title={invitation.email}
                  meta={m.sharing_invited_meta({
                    date: formatDay(invitation.createdAt),
                    expires: formatDay(invitation.expiresAt),
                  })}
                  action={
                    isOwner ? (
                      <Button
                        variant="text"
                        color="inherit"
                        disabled={busy}
                        aria-label={m.sharing_cancel_invitation_label({
                          email: invitation.email,
                        })}
                        onClick={() => {
                          void change('sharing.cancel_failed', () =>
                            cancelInvitation({
                              data: { invitationId: invitation.id },
                            }),
                          )
                        }}
                        sx={{ minHeight: 44, textDecoration: 'underline' }}
                      >
                        {m.sharing_cancel_invitation()}
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </Box>
          </Section>
        )}
        {isOwner ? (
          <InviteForm
            propertyId={view.property.id}
            onSent={async (email) => {
              setSentTo(email)
              await onChanged()
            }}
          />
        ) : (
          <Button
            variant="outlined"
            color="error"
            size="large"
            onClick={() => {
              setConfirm({ kind: 'leave' })
            }}
            sx={{
              color: colors.error,
              borderColor: colors.errorBorder,
              bgcolor: 'background.paper',
            }}
          >
            {m.sharing_leave()}
          </Button>
        )}
      </Stack>
      <Dialog
        open={confirm !== undefined}
        onClose={() => {
          setConfirm(undefined)
        }}
        aria-labelledby="sharing-confirm-title"
      >
        {confirm === undefined ? null : (
          <>
            <DialogTitle
              id="sharing-confirm-title"
              sx={{ fontSize: 20, fontWeight: 900, lineHeight: 1.3 }}
            >
              {confirm.kind === 'remove'
                ? m.sharing_remove_dialog_title({ name: confirm.person.name })
                : m.sharing_leave_dialog_title()}
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                {confirm.kind === 'remove'
                  ? m.sharing_remove_dialog_text({
                      name: confirm.person.name,
                      address,
                    })
                  : m.sharing_leave_dialog_text({ address })}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button
                variant="text"
                color="inherit"
                onClick={() => {
                  setConfirm(undefined)
                }}
              >
                {m.sharing_dialog_cancel()}
              </Button>
              <Button
                color="error"
                loading={busy}
                onClick={() => {
                  if (confirm.kind === 'remove') {
                    const userId = confirm.person.userId
                    void change('sharing.remove_failed', () =>
                      removeAccess({
                        data: { propertyId: view.property.id, userId },
                      }),
                    )
                  } else {
                    void change(
                      'sharing.leave_failed',
                      () =>
                        leaveProperty({
                          data: { propertyId: view.property.id },
                        }),
                      onLeft,
                    )
                  }
                }}
              >
                {confirm.kind === 'remove'
                  ? m.sharing_remove_dialog_confirm()
                  : m.sharing_leave_dialog_confirm()}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      <Snackbar
        open={sentTo !== undefined}
        autoHideDuration={5000}
        onClose={() => {
          setSentTo(undefined)
        }}
        message={
          sentTo === undefined ? '' : m.sharing_invite_sent({ email: sentTo })
        }
        slotProps={{
          content: {
            sx: { bgcolor: 'primary.main', color: 'primary.contrastText' },
          },
        }}
      />
    </Stack>
  )
}

function InviteForm(props: {
  propertyId: string
  onSent: (email: string) => Promise<void>
}) {
  const [alert, setAlert] = useState<AlertReason>()
  const [fieldReason, setFieldReason] = useState<FieldReason>()
  const form = useForm({
    defaultValues: { email: '' },
    // The same check as the sign-in address: { email }.
    validators: { onChange: requestCodeInput },
    onSubmit: async ({ value, formApi }) => {
      setAlert(undefined)
      setFieldReason(undefined)
      const email = emailSchema.parse(value.email)
      try {
        const result = await inviteToProperty({
          data: { propertyId: props.propertyId, email },
        })
        if (result.ok) {
          formApi.reset()
          await props.onSent(email)
        } else if (
          result.reason === 'invitation_already_member' ||
          result.reason === 'invitation_already_pending'
        ) {
          setFieldReason(result.reason)
        } else {
          setAlert(result.reason)
        }
      } catch (error) {
        clientLog.error('sharing.invite_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="invite-title"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      sx={{ ...card, gap: 1.5, p: 2 }}
    >
      <Stack sx={{ gap: 0.5 }}>
        <Typography
          id="invite-title"
          variant="h4"
          component="h2"
          sx={{ fontWeight: 900 }}
        >
          {m.sharing_invite_title()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {m.sharing_invite_hint()}
        </Typography>
      </Stack>
      <form.Field
        name="email"
        listeners={{
          onChange: () => {
            setFieldReason(undefined)
          },
        }}
      >
        {(field) => (
          <TextField
            field={field}
            reason={fieldReason}
            label={m.sharing_invite_email()}
            type="email"
            autoComplete="off"
            slotProps={{ htmlInput: { inputMode: 'email' } }}
            fullWidth
          />
        )}
      </form.Field>
      {alert === undefined ? null : <ReasonAlert reason={alert} />}
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(submitting) => (
          <Button
            type="submit"
            size="large"
            loading={submitting}
            loadingPosition="start"
          >
            {submitting ? m.sharing_invite_sending() : m.sharing_invite_send()}
          </Button>
        )}
      </form.Subscribe>
    </Stack>
  )
}
