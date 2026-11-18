// A MUI text field bound to a TanStack Form field. Errors are reason codes
// (src/lib/reasons.ts), shown as text in the user's language under the field.
import MuiTextField, { type TextFieldProps } from '@mui/material/TextField'
import { useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { isReason, reasonText, type Reason } from '#/lib/reasons'

type Props = Omit<
  TextFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'error' | 'helperText'
> & {
  field: AnyFieldApi
  /**
   * An error from outside the form's validators, e.g. a server function's
   * `code_wrong`. Shown instead of the validators' error.
   */
  reason?: Reason | undefined
}

/** The first error as a reason code. Zod issues carry it as `message`. */
function firstReason(errors: unknown[]): Reason | undefined {
  for (const error of errors) {
    const code =
      typeof error === 'object' && error !== null && 'message' in error
        ? error.message
        : error
    if (isReason(code)) {
      return code
    }
  }
  return undefined
}

export function TextField({ field, reason, disabled, ...props }: Props) {
  const errors = useSelector(field.store, (s): unknown[] => s.meta.errors)
  const blurred = useSelector(field.store, (s) => s.meta.isBlurred)
  const submitted = useSelector(
    field.form.store,
    (s) => s.submissionAttempts > 0,
  )
  const submitting = useSelector(field.form.store, (s) => s.isSubmitting)
  const value = useSelector(field.store, (s): unknown => s.value)
  const name = String(field.name)

  // Validator errors show once the user has left the field or submitted, not
  // while typing a first attempt.
  const shown =
    reason ?? (blurred || submitted ? firstReason(errors) : undefined)

  return (
    <MuiTextField
      {...props}
      id={props.id ?? name}
      name={name}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        field.handleChange(e.target.value)
      }}
      onBlur={() => {
        field.handleBlur()
      }}
      disabled={disabled === true || submitting}
      error={shown !== undefined}
      helperText={shown === undefined ? undefined : reasonText(shown).text}
    />
  )
}
