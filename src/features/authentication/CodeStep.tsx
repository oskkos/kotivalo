// Sign-in, step 2 (Design canvas: SignInCode): the emailed code.
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { Logo } from '#/components/Logo'
import { ReasonAlert } from '#/components/ReasonAlert'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { SIGN_IN_CODE } from '#/server/auth/auth'
import { CodeField } from './CodeField'
import { requestSignInCode, verifySignInCode } from './functions'

/** Seconds after a send before another code can be requested. */
export const RESEND_AFTER_SECONDS = 30

interface Props {
  email: string
  /** When the current code was sent, in epoch milliseconds. */
  sentAt: number
  onResent: (sentAt: number) => void
  onChangeEmail: () => void
  onSignedIn: () => void
}

function secondsLeft(sentAt: number): number {
  return Math.max(
    0,
    RESEND_AFTER_SECONDS - Math.floor((Date.now() - sentAt) / 1000),
  )
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
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

/** "We sent a code to <strong>address</strong>.", in any word order. */
function SentTo({ email }: { email: string }) {
  const text = m.sign_in_code_sent({ email })
  const at = text.indexOf(email)
  if (at === -1) {
    return text
  }
  return (
    <>
      {text.slice(0, at)}
      <strong>{email}</strong>
      {text.slice(at + email.length)}
    </>
  )
}

export function CodeStep(props: Props) {
  const { email, sentAt } = props
  const [code, setCode] = useState('')
  const [fieldReason, setFieldReason] = useState<FieldReason>()
  const [alert, setAlert] = useState<AlertReason>()
  const [busy, setBusy] = useState<'verify' | 'resend'>()
  const [wait, setWait] = useState(() => secondsLeft(sentAt))

  // A new send remounts this step (SignInPage keys it by sentAt), so the
  // initial state above is right and the timer only counts down.
  useEffect(() => {
    const timer = setInterval(() => {
      const left = secondsLeft(sentAt)
      setWait(left)
      if (left === 0) {
        clearInterval(timer)
      }
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [sentAt])

  // An expired or used-up code can be replaced at once.
  const codeDead = alert === 'code_expired' || alert === 'code_attempts_used'
  const canResend = (wait === 0 || codeDead) && busy === undefined

  async function verify(value: string) {
    setBusy('verify')
    setFieldReason(undefined)
    setAlert(undefined)
    try {
      const result = await verifySignInCode({ data: { email, code: value } })
      if (result.ok) {
        props.onSignedIn()
        return
      }
      if (result.reason === 'code_wrong' || result.reason === 'code_invalid') {
        setFieldReason(result.reason)
      } else {
        setAlert(result.reason as AlertReason)
      }
    } catch (error) {
      clientLog.error('authentication.verify_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(undefined)
    }
  }

  async function resend() {
    setBusy('resend')
    setFieldReason(undefined)
    setAlert(undefined)
    try {
      const result = await requestSignInCode({ data: { email } })
      if (result.ok) {
        setCode('')
        props.onResent(Date.now())
      } else {
        setAlert(result.reason)
      }
    } catch (error) {
      clientLog.error('authentication.resend_failed', {}, error)
      setAlert(failureReason(error))
    } finally {
      setBusy(undefined)
    }
  }

  const complete = code.length === SIGN_IN_CODE.length
  const minutes = String(Math.floor(wait / 60))
  const seconds = String(wait % 60).padStart(2, '0')

  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Stack component="header" sx={{ px: 2.5, pt: 7 }}>
        <Logo size={28} />
      </Stack>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 3.5, pb: 3 }}
      >
        <Typography variant="h1">{m.sign_in_code_title()}</Typography>
        <Typography>
          <SentTo email={email} />{' '}
          {m.sign_in_code_validity({
            minutes: SIGN_IN_CODE.validSeconds / 60,
          })}
        </Typography>
        <Stack
          component="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (complete) {
              void verify(code)
            }
          }}
          sx={{ gap: 1.75, mt: 0.75 }}
        >
          <CodeField
            value={code}
            reason={fieldReason}
            disabled={busy !== undefined}
            onChange={(value) => {
              setCode(value)
              setFieldReason(undefined)
              // The sixth digit signs in; the button is the fallback.
              if (value.length === SIGN_IN_CODE.length && busy === undefined) {
                void verify(value)
              }
            }}
          />
          {alert === undefined ? null : <ReasonAlert reason={alert} />}
          <Button
            type="submit"
            size="large"
            disabled={!complete}
            loading={busy === 'verify'}
            loadingPosition="start"
            sx={{ minHeight: 56, fontSize: 17 }}
          >
            {busy === 'verify' ? m.sign_in_signing_in() : m.sign_in_submit()}
          </Button>
        </Stack>
        <Stack sx={{ alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Button
            variant={codeDead ? 'contained' : 'outlined'}
            color={codeDead ? 'accent' : 'primary'}
            disabled={!canResend}
            loading={busy === 'resend'}
            onClick={() => {
              void resend()
            }}
          >
            {m.sign_in_resend()}
          </Button>
          {canResend || codeDead ? null : (
            <Typography variant="caption" color="text.secondary">
              {m.sign_in_resend_wait({ time: `${minutes}:${seconds}` })}
            </Typography>
          )}
          <Link
            component="button"
            type="button"
            onClick={props.onChangeEmail}
            sx={{ minHeight: 44, fontSize: 15, fontWeight: 800 }}
          >
            {m.sign_in_change_email()}
          </Link>
        </Stack>
        <Stack
          direction="row"
          sx={{
            mt: 'auto',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
          }}
        >
          <MailIcon />
          <Typography variant="body2">{m.sign_in_spam_hint()}</Typography>
        </Stack>
      </Stack>
    </Stack>
  )
}
