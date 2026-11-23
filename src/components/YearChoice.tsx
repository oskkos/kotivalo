// A choice of years as toggle buttons, newest first, as on the rent
// payments and charges pages.
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { TOUCH_TARGET } from '#/theme/theme'

interface Props {
  /** The group's accessible name. */
  label: string
  years: readonly number[]
  /** The year shown. */
  year: number
  onYear: (year: number) => void
}

export function YearChoice(props: Props) {
  return (
    <Stack
      role="group"
      aria-label={props.label}
      direction="row"
      sx={{ gap: 1, flexWrap: 'wrap' }}
    >
      {props.years.map((option) => {
        const pressed = option === props.year
        return (
          <Button
            key={option}
            variant={pressed ? 'contained' : 'outlined'}
            aria-pressed={pressed}
            onClick={() => {
              props.onYear(option)
            }}
            sx={{ borderRadius: 999, minHeight: TOUCH_TARGET, px: 2.25 }}
          >
            {String(option)}
          </Button>
        )
      })}
    </Stack>
  )
}
