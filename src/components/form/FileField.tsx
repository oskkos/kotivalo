// A file chosen for upload (a receipt, a document): one dashed button that
// opens the device's camera or files, then the chosen file's name and size
// with Remove, and the reason under it. For an edited record a file it
// already has (`kept`) is shown first, with Replace and Remove. The parent
// owns the file and prepares it (src/lib/resize-image.ts) when saving.
import FormHelperText from '@mui/material/FormHelperText'
import ButtonBase from '@mui/material/ButtonBase'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, useRef } from 'react'
import { formatFileSize } from '#/lib/format'
import { reasonText, type FieldReason } from '#/lib/reasons'
import { UPLOAD_ACCEPT } from '#/lib/resize-image'
import { colors, radii } from '#/theme/tokens'

const CLOSE = 'M6 6 L18 18 M18 6 L6 18'
const CAMERA =
  'M4 8 H7 L9 5 H15 L17 8 H20 V19 H4 Z M15.2 13 a3.2 3.2 0 1 1 -6.4 0 a3.2 3.2 0 1 1 6.4 0'

function Icon(props: { path: string; size: number; width: number }) {
  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={props.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={props.path} />
    </svg>
  )
}

interface Props {
  /** The section's heading. */
  title: string
  /** The chosen file, if any. */
  file: File | undefined
  /** A file the edited record already has; shown until removed or replaced. */
  kept?: { filename: string; size: number } | null
  /** The shown reason, once there is one. */
  reason: FieldReason | undefined
  /** True while the form is submitting. */
  submitting: boolean
  onChoose: (file: File) => void
  onRemove: () => void
  onRemoveKept?: () => void
  labels: {
    /** The button's text and the file input's name. */
    attach: string
    hint: string
    /** Shown instead of the size while submitting. */
    saving: string
    remove: string
    replace: string
  }
}

export function FileField(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const { file, kept, reason, submitting, labels } = props
  const tile = {
    alignItems: 'center',
    gap: 1.5,
    bgcolor: 'background.paper',
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: `${String(radii.tile)}px`,
    py: 1.25,
    pl: 1.75,
    pr: 1,
  } as const
  return (
    <Stack component="section" aria-labelledby={id} sx={{ gap: 0.75 }}>
      <Typography
        id={id}
        variant="h4"
        component="h2"
        sx={{ fontSize: 14, fontWeight: 900 }}
      >
        {props.title}
      </Typography>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        hidden
        aria-label={labels.attach}
        onChange={(e) => {
          const chosen = e.target.files?.[0]
          if (chosen) {
            props.onChoose(chosen)
          }
          e.target.value = ''
        }}
      />
      {kept && !file ? (
        <Stack direction="row" sx={tile}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 900 }}>
              {kept.filename}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatFileSize(kept.size)}
            </Typography>
          </Stack>
          <Button
            variant="text"
            color="inherit"
            disabled={submitting}
            onClick={() => inputRef.current?.click()}
            sx={{ textDecoration: 'underline' }}
          >
            {labels.replace}
          </Button>
          <IconButton
            aria-label={labels.remove}
            disabled={submitting}
            onClick={props.onRemoveKept}
          >
            <Icon path={CLOSE} size={20} width={2.4} />
          </IconButton>
        </Stack>
      ) : file ? (
        <Stack direction="row" sx={tile}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 900 }}>
              {file.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {submitting ? labels.saving : formatFileSize(file.size)}
            </Typography>
          </Stack>
          <IconButton
            aria-label={labels.remove}
            disabled={submitting}
            onClick={props.onRemove}
          >
            <Icon path={CLOSE} size={20} width={2.4} />
          </IconButton>
        </Stack>
      ) : (
        <ButtonBase
          aria-describedby={reason ? `${id}-reason` : undefined}
          onClick={() => inputRef.current?.click()}
          sx={{
            flexDirection: 'column',
            gap: 0.25,
            minHeight: 64,
            border: `1.5px dashed ${reason ? colors.error : colors.dashed}`,
            borderRadius: `${String(radii.tile)}px`,
            fontFamily: 'inherit',
          }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Icon path={CAMERA} size={20} width={2.2} />
            <Typography sx={{ fontSize: 15, fontWeight: 800 }}>
              {labels.attach}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {labels.hint}
          </Typography>
        </ButtonBase>
      )}
      {reason === undefined ? null : (
        <FormHelperText id={`${id}-reason`} error>
          {reasonText(reason).text}
        </FormHelperText>
      )}
    </Stack>
  )
}
