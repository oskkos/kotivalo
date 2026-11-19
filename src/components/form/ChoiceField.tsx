// One choice from a few options, as a row of toggle buttons (Design canvas:
// the room count on "Uusi asunto"), bound to a TanStack Form field. Errors
// are reason codes, shown under the group like TextField's.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormHelperText from '@mui/material/FormHelperText'
import Typography from '@mui/material/Typography'
import { useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { reasonText, type Reason } from '#/lib/reasons'
import { colors, radii } from '#/theme/tokens'
import { firstReason } from './reason'

export interface Choice<T> {
  value: T
  label: string
}

interface Props<T> {
  field: AnyFieldApi
  label: string
  choices: readonly Choice<T>[]
  /** An error from outside the form's validators, e.g. a server's. */
  reason?: Reason | undefined
}

export function ChoiceField<T extends string | number>({
  field,
  label,
  choices,
  reason,
}: Props<T>) {
  const errors = useSelector(field.store, (s): unknown[] => s.meta.errors)
  const submitted = useSelector(
    field.form.store,
    (s) => s.submissionAttempts > 0,
  )
  const submitting = useSelector(field.form.store, (s) => s.isSubmitting)
  const value = useSelector(field.store, (s): unknown => s.value)
  const name = String(field.name)
  const labelId = `${name}-label`
  const helperId = `${name}-helper-text`

  // A choice can't be half-made, so errors show only after submitting.
  const shown = reason ?? (submitted ? firstReason(errors) : undefined)

  return (
    <Box
      role="group"
      aria-labelledby={labelId}
      aria-describedby={shown === undefined ? undefined : helperId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Typography
        id={labelId}
        variant="body2"
        component="span"
        sx={{ fontWeight: 800, color: 'text.secondary' }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${String(choices.length)}, minmax(0, 1fr))`,
          gap: 0.75,
        }}
      >
        {choices.map((choice) => {
          const pressed = choice.value === value
          return (
            <Button
              key={choice.value}
              type="button"
              aria-pressed={pressed}
              disabled={submitting}
              onClick={() => {
                field.handleChange(choice.value)
                field.handleBlur()
              }}
              sx={{
                borderRadius: `${String(radii.input)}px`,
                border: 1.5,
                borderColor: pressed
                  ? 'primary.main'
                  : shown === undefined
                    ? colors.inputBorder
                    : 'error.main',
                bgcolor: pressed ? 'primary.main' : 'background.paper',
                color: pressed ? 'primary.contrastText' : 'text.primary',
                fontSize: 14,
                fontWeight: 800,
                '&:hover': {
                  bgcolor: pressed ? 'primary.main' : colors.sand,
                },
              }}
            >
              {choice.label}
            </Button>
          )
        })}
      </Box>
      {shown !== undefined && (
        <FormHelperText id={helperId} error>
          {reasonText(shown).text}
        </FormHelperText>
      )}
    </Box>
  )
}
