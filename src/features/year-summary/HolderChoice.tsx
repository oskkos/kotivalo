// "Kenen luvut": a button under the year that opens a bottom sheet with the
// people whose figures can be shown (openspec: year-summary, "Choosing whose
// figures"; Design canvas, section #122).
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { personParam } from './holder'
import type { YearSummaryView } from './view'

interface Props {
  holder: YearSummaryView['holder']
  people: YearSummaryView['people']
  counts: YearSummaryView['counts']
  /** The chosen `person` parameter; undefined for the own share. */
  onChoose: (person: string | undefined) => void
}

const OWN = 'own'

export function HolderChoice(props: Props) {
  const [open, setOpen] = useState(false)
  const chosen = personParam(props.holder) ?? OWN
  const current =
    props.holder.kind === 'own'
      ? m.year_summary_holder_own()
      : props.holder.kind === 'whole'
        ? m.year_summary_holder_whole()
        : props.holder.name
  const options = [
    {
      value: OWN,
      label: m.year_summary_holder_own(),
      flats: props.counts.own,
    },
    ...props.people.map((person) => ({
      value: person.userId,
      label: person.name,
      flats: person.flats,
    })),
    {
      value: 'whole',
      label: m.year_summary_holder_whole(),
      flats: props.counts.whole,
    },
  ]
  return (
    <>
      <ButtonBase
        onClick={() => {
          setOpen(true)
        }}
        aria-haspopup="dialog"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          minHeight: 48,
          bgcolor: 'background.paper',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: `${String(radii.tile)}px`,
          px: 2,
          py: 1,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <Stack>
          <Typography
            component="span"
            sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}
          >
            {m.year_summary_holder_label()}
          </Typography>
          <Typography component="span" sx={{ fontSize: 15, fontWeight: 900 }}>
            {current}
          </Typography>
        </Stack>
        <Box sx={{ display: 'flex', color: 'text.secondary' }}>
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9 L12 15 L18 9" />
          </svg>
        </Box>
      </ButtonBase>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        slotProps={{
          paper: {
            'aria-labelledby': 'holder-choice-title',
            role: 'dialog',
          },
        }}
      >
        <Stack sx={{ px: 2.5, pt: 2.5, pb: 3, gap: 1.5 }}>
          <Typography
            id="holder-choice-title"
            component="h2"
            sx={{ fontSize: 19, fontWeight: 900 }}
          >
            {m.year_summary_holder_sheet_title()}
          </Typography>
          <RadioGroup
            value={chosen}
            onChange={(event) => {
              const value = event.target.value
              setOpen(false)
              props.onChoose(value === OWN ? undefined : value)
            }}
          >
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio />}
                label={
                  <Stack>
                    <Typography component="span" sx={{ fontWeight: 900 }}>
                      {option.label}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: 'text.secondary',
                      }}
                    >
                      {m.year_summary_holder_flats({ count: option.flats })}
                    </Typography>
                  </Stack>
                }
                sx={{ minHeight: 56, m: 0 }}
              />
            ))}
          </RadioGroup>
          <Button
            variant="outlined"
            onClick={() => {
              setOpen(false)
            }}
          >
            {m.year_summary_holder_sheet_close()}
          </Button>
        </Stack>
      </Drawer>
    </>
  )
}
