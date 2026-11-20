// /welcome (Design canvas: Welcome): the display name, asked once after the
// first sign-in (spec: "Asking for a display name").
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { Logo } from '#/components/Logo'
import { ReasonAlert } from '#/components/ReasonAlert'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { setDisplayName } from './functions'
import { displayNameInput, displayNameSchema } from './schemas'

interface Props {
  onSaved: () => void
}

export function WelcomePage({ onSaved }: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  const form = useForm({
    defaultValues: { name: '' },
    validators: { onChange: displayNameInput },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      try {
        await setDisplayName({
          data: { name: displayNameSchema.parse(value.name) },
        })
        onSaved()
      } catch (error) {
        clientLog.error('authentication.name_save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Stack component="header" sx={{ gap: 0.25, px: 2.5, pt: 7 }}>
        <Logo />
        <Typography variant="body2" color="text.secondary">
          {m.app_tagline()}
        </Typography>
      </Stack>
      <Stack component="main" sx={{ gap: 1.75, px: 2.5, pt: 3.5 }}>
        <Typography variant="h1">{m.welcome_title()}</Typography>
        <Stack sx={{ gap: 0.5 }}>
          <Typography>{m.welcome_question()}</Typography>
          <Typography variant="body2" color="text.secondary">
            {m.welcome_hint()}
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
          <form.Field name="name">
            {(field) => (
              <TextField
                field={field}
                label={m.welcome_name_label()}
                autoComplete="given-name"
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
                {submitting ? m.welcome_saving() : m.welcome_continue()}
              </Button>
            )}
          </form.Subscribe>
        </Stack>
      </Stack>
    </Stack>
  )
}
