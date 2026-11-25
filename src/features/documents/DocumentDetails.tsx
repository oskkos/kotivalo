// A document's details (Design canvas: "Dokumentin tiedot"): a preview, its
// name, kind and date, the file, who added it and, for a lease, its tenancy;
// Download for everyone, Edit and Delete for owners (openspec: documents,
// "Document details", "Viewing and downloading a document").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState, type ReactNode } from 'react'
import { ImageViewer } from '#/components/ImageViewer'
import type { Property } from '#/features/properties/property'
import { formatDate, formatDay, formatFileSize } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { PropertyRole } from '#/server/db/schema'
import { colors, radii } from '#/theme/tokens'
import { DeleteDocumentDialog } from './DeleteDocumentDialog'
import type { DocumentDetails as Details } from './document.repository.server'
import { Icon } from './DocumentsPage'
import { documentUrl, kindLabel } from './kinds'

interface Props {
  document: Details
  property: Property
  role: PropertyRole
  /** Whether the signed-in user added it, shown as "You". */
  addedByYou: boolean
  onBack: () => void
  /** The edit button, for owners. */
  editAction?: ReactNode
  /** After deleting the document. */
  onDeleted: () => Promise<void>
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

const BACK = 'M15 5 L8 12 L15 19'
const DOWNLOAD = 'M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19'

function Row(props: { label: string; value: string; first?: boolean }) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        minHeight: 46,
        borderTop: props.first ? 'none' : `1px solid ${colors.divider}`,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: 'text.secondary' }}
      >
        {props.label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 800, textAlign: 'right', minWidth: 0 }}
      >
        {props.value}
      </Typography>
    </Stack>
  )
}

export function DocumentDetails(props: Props) {
  const { document } = props
  const [viewing, setViewing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isPdf = document.contentType === 'application/pdf'
  const owner = props.role === 'owner'
  const adder = props.addedByYou ? m.sharing_you() : document.uploadedBy.name
  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Box
        component="header"
        sx={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 44px',
          alignItems: 'center',
          px: 1.5,
          pt: 2,
          pb: 0.5,
        }}
      >
        <IconButton aria-label={m.amounts_back()} onClick={props.onBack}>
          <Icon path={BACK} />
        </IconButton>
        <Typography
          variant="h3"
          component="h1"
          sx={{ fontSize: 18, textAlign: 'center' }}
          noWrap
        >
          {document.name}
        </Typography>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 0.5, pb: 3 }}
      >
        {isPdf ? (
          <Button
            variant="outlined"
            href={documentUrl(document.id)}
            target="_blank"
            rel="noopener"
            sx={{
              height: 120,
              borderRadius: `${String(radii.card)}px`,
              flexDirection: 'column',
              bgcolor: colors.sand,
            }}
          >
            <Typography variant="body2">{m.documents_open_pdf()}</Typography>
          </Button>
        ) : (
          <ButtonBase
            onClick={() => {
              setViewing(true)
            }}
            aria-label={m.documents_preview_alt({ name: document.name })}
            sx={{
              height: 214,
              borderRadius: `${String(radii.card)}px`,
              bgcolor: colors.sand,
              overflow: 'hidden',
            }}
          >
            <Box
              component="img"
              src={documentUrl(document.id)}
              alt=""
              sx={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            />
          </ButtonBase>
        )}
        <Box sx={{ ...card, px: 2 }}>
          <Row
            first
            label={m.documents_kind()}
            value={kindLabel[document.kind]()}
          />
          <Row label={m.documents_date()} value={formatDate(document.date)} />
          {document.kind === 'lease' && document.tenantName ? (
            <Row
              label={m.documents_tenancy()}
              value={m.documents_tenancy_of({ name: document.tenantName })}
            />
          ) : null}
          <Row
            label={m.documents_file()}
            value={`${document.filename} · ${formatFileSize(document.size)}`}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {m.documents_added_by({
            name: adder,
            date: formatDay(document.createdAt),
          })}
        </Typography>
        <Box
          sx={{
            mt: 'auto',
            display: 'grid',
            gridTemplateColumns: owner && props.editAction ? '1fr 1fr' : '1fr',
            gap: 1.25,
          }}
        >
          <Button
            variant="outlined"
            href={documentUrl(document.id, true)}
            startIcon={<Icon path={DOWNLOAD} size={18} />}
            sx={{ minHeight: 52, borderRadius: 999 }}
          >
            {m.documents_download()}
          </Button>
          {owner ? props.editAction : null}
        </Box>
        {owner ? (
          <Button
            variant="text"
            color="error"
            onClick={() => {
              setDeleting(true)
            }}
            sx={{ alignSelf: 'flex-start' }}
          >
            {m.documents_delete()}
          </Button>
        ) : null}
      </Stack>
      {isPdf ? null : (
        <ImageViewer
          src={documentUrl(document.id)}
          downloadHref={documentUrl(document.id, true)}
          filename={document.filename}
          title={m.documents_title()}
          alt={m.documents_preview_alt({ name: document.name })}
          closeLabel={m.documents_close()}
          downloadLabel={m.documents_download()}
          open={viewing}
          onClose={() => {
            setViewing(false)
          }}
        />
      )}
      {owner ? (
        <DeleteDocumentDialog
          open={deleting}
          document={document}
          onClose={() => {
            setDeleting(false)
          }}
          onDeleted={props.onDeleted}
        />
      ) : null}
    </Stack>
  )
}
