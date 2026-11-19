// Something the user asked for doesn't exist (or isn't theirs): a title, a
// short text and the way back.
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link } from '@tanstack/react-router'

export function NotFoundView(props: {
  title: string
  text: string
  /** The link back to the home page. */
  backLabel: string
}) {
  return (
    <Stack component="main" sx={{ gap: 1, px: 2.5, py: 6 }}>
      <Typography variant="h1">{props.title}</Typography>
      <Typography color="text.secondary">{props.text}</Typography>
      <Button
        component={Link}
        to="/"
        variant="outlined"
        sx={{ alignSelf: 'flex-start', mt: 2 }}
      >
        {props.backLabel}
      </Button>
    </Stack>
  )
}
