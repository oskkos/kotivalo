// The sign-in code input (Design canvas: SignInCode): six boxes drawn over one
// transparent numeric input, so phones can fill the code from the email
// (autocomplete="one-time-code") and pasting works.
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useId, useState } from 'react'
import { reasonText, type FieldReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { SIGN_IN_CODE } from '#/server/auth/auth'
import { colors } from '#/theme/tokens'

interface Props {
  value: string
  onChange: (code: string) => void
  reason?: FieldReason | undefined
  disabled?: boolean
}

export function CodeField({
  value,
  onChange,
  reason,
  disabled = false,
}: Props) {
  const id = useId()
  const errorId = `${id}-error`
  const [focused, setFocused] = useState(false)
  const active = focused && !disabled ? Math.min(value.length, 5) : -1
  const invalid = reason !== undefined

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography
        component="label"
        htmlFor={id}
        variant="body2"
        sx={{ fontWeight: 800, color: 'text.secondary' }}
      >
        {m.sign_in_code_label()}
      </Typography>
      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${String(SIGN_IN_CODE.length)}, minmax(0, 1fr))`,
          gap: 1,
        }}
      >
        {Array.from({ length: SIGN_IN_CODE.length }, (_, i) => (
          <Box
            key={i}
            aria-hidden="true"
            sx={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '14px',
              bgcolor: 'background.paper',
              border: '2px solid',
              borderColor: invalid
                ? colors.error
                : i === active
                  ? colors.plum
                  : colors.inputBorder,
              boxShadow:
                i === active && !invalid
                  ? '0 0 0 4px rgba(255,176,32,0.35)'
                  : 'none',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            {value[i] ?? ''}
          </Box>
        ))}
        <Box
          component="input"
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={SIGN_IN_CODE.length}
          value={value}
          readOnly={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(
              e.target.value.replace(/\D/g, '').slice(0, SIGN_IN_CODE.length),
            )
          }}
          onFocus={() => {
            setFocused(true)
          }}
          onBlur={() => {
            setFocused(false)
          }}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.01,
            border: 'none',
            fontSize: 16,
            color: 'transparent',
            background: 'transparent',
            caretColor: 'transparent',
          }}
        />
      </Box>
      {invalid ? (
        <Typography
          id={errorId}
          variant="body2"
          sx={{ color: 'error.main', fontWeight: 800 }}
        >
          {reasonText(reason).text}
        </Typography>
      ) : null}
    </Box>
  )
}
