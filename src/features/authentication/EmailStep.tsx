// Sign-in, step 1 (Design canvas: SignInEmail): the email address.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { LanguageMenu } from '#/components/LanguageMenu'
import { Logo, LogoMark } from '#/components/Logo'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors } from '#/theme/tokens'
import { chosenLocale } from '#/lib/chosen-locale'
import { requestSignInCode } from './functions'
import { emailSchema, requestCodeInput } from './schemas'

interface Props {
  defaultEmail: string
  /** The code was sent to this (normalised) address. */
  onSent: (email: string) => void
}

export function EmailStep({ defaultEmail, onSent }: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  const form = useForm({
    defaultValues: { email: defaultEmail },
    validators: { onChange: requestCodeInput },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      const email = emailSchema.parse(value.email)
      try {
        const result = await requestSignInCode({
          data: { email, locale: chosenLocale() },
        })
        if (result.ok) {
          onSent(email)
        } else {
          setAlert(result.reason)
        }
      } catch (error) {
        clientLog.error('authentication.code_request_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Box sx={{ position: 'relative', minHeight: '100dvh', overflow: 'hidden' }}>
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          right: -110,
          bottom: -90,
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      >
        <LogoMark size={320} roof={colors.lavender} />
      </Box>
      <Stack
        component="header"
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          px: 2.5,
          pt: 7,
        }}
      >
        <Stack sx={{ gap: 0.25 }}>
          <Logo />
          <Typography variant="body2" color="text.secondary">
            {m.app_tagline()}
          </Typography>
        </Stack>
        <LanguageMenu />
      </Stack>
      <Stack
        component="main"
        sx={{ position: 'relative', gap: 1.75, px: 2.5, pt: 3.5 }}
      >
        <Typography variant="h1">{m.sign_in_title()}</Typography>
        <Stack sx={{ gap: 0.5 }}>
          <Typography>{m.sign_in_intro()}</Typography>
          <Typography variant="body2" color="text.secondary">
            {m.sign_in_new_account()}
          </Typography>
        </Stack>
        <Stack
          component="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          sx={{ gap: 1.75, mt: 0.5 }}
        >
          <form.Field name="email">
            {(field) => (
              <TextField
                field={field}
                label={m.sign_in_email_label()}
                placeholder={m.sign_in_email_placeholder()}
                type="email"
                autoComplete="email"
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
                sx={{ minHeight: 56, fontSize: 17 }}
              >
                {submitting ? m.sign_in_sending() : m.sign_in_send_code()}
              </Button>
            )}
          </form.Subscribe>
        </Stack>
      </Stack>
    </Box>
  )
}
