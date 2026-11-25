// A flat's documents page (Design canvas: Dokumentit): the documents grouped
// by kind, with filter buttons; owners add and see their storage use
// (openspec: documents, "The documents page").
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate, formatFileSize } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { DocumentKind } from '#/server/db/schema'
import { STORAGE_QUOTA } from '#/server/files/quota'
import { colors, radii } from '#/theme/tokens'
import type { DocumentRow } from './document.repository.server'
import type { DocumentsView } from './documents.server'
import { groupByKind, kindHeading, kindLabel } from './kinds'

interface Props {
  view: DocumentsView
  onBack: () => void
}

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

const RowLink = createLink(Link)
const ButtonLink = createLink(Button)

const BACK = 'M15 5 L8 12 L15 19'
const PLUS = 'M12 5 V19 M5 12 H19'
const FILE = 'M7 3 H14 L18 7 V21 H7 Z M14 3 V7 H18'

export function Icon(props: { path: string; size?: number }) {
  const size = props.size ?? 24
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={props.path} />
    </svg>
  )
}

/** One document in a list: name, then kind, date and size. */
export function DocumentRowItem(props: {
  document: DocumentRow
  propertyId: string
  first: boolean
}) {
  const { document } = props
  return (
    <Box
      component="li"
      sx={{ borderTop: props.first ? 'none' : `1px solid ${colors.divider}` }}
    >
      <RowLink
        to="/properties/$propertyId/documents/$documentId"
        params={{ propertyId: props.propertyId, documentId: document.id }}
        underline="none"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 64,
          px: 1.75,
          py: 1,
          color: 'text.primary',
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '19px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: colors.lavenderTint,
          }}
        >
          <Icon path={FILE} size={18} />
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 15, fontWeight: 900 }}>
            {document.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {[
              kindLabel[document.kind](),
              formatDate(document.date),
              formatFileSize(document.size),
            ].join(' · ')}
          </Typography>
        </Stack>
      </RowLink>
    </Box>
  )
}

export function DocumentsPage(props: Props) {
  const { view } = props
  const isOwner = view.role === 'owner'
  const [filter, setFilter] = useState<DocumentKind>()
  const groups = groupByKind(view.documents)
  const shown = filter
    ? groups.filter((group) => group.kind === filter)
    : groups
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
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 18 }}>
            {m.documents_title()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {view.property.streetAddress}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.5, px: 2.5, pt: 1.25, pb: 3 }}
      >
        {groups.length === 0 ? (
          <Stack
            component="section"
            sx={{
              ...card,
              px: 2.5,
              py: 3,
              gap: 1.25,
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <Typography variant="h3" component="h2" sx={{ fontSize: 17 }}>
              {m.documents_empty_title()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {m.documents_empty_text()}
            </Typography>
          </Stack>
        ) : (
          <>
            <Stack
              role="group"
              aria-label={m.documents_filter()}
              direction="row"
              sx={{ gap: 1, flexWrap: 'wrap' }}
            >
              {[undefined, ...groups.map((group) => group.kind)].map((kind) => {
                const pressed = kind === filter
                return (
                  <Button
                    key={kind ?? 'all'}
                    variant={pressed ? 'contained' : 'outlined'}
                    aria-pressed={pressed}
                    onClick={() => {
                      setFilter(kind)
                    }}
                    sx={{ borderRadius: 999, minHeight: 44, px: 2.25 }}
                  >
                    {kind ? kindHeading[kind]() : m.documents_all()}
                  </Button>
                )
              })}
            </Stack>
            {shown.map((group) => (
              <Stack
                key={group.kind}
                component="section"
                aria-label={kindHeading[group.kind]()}
                sx={{ gap: 0.75 }}
              >
                <Typography
                  variant="h3"
                  component="h2"
                  sx={{ fontSize: 15, mt: 0.5 }}
                >
                  {kindHeading[group.kind]()}
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    ...card,
                    m: 0,
                    p: 0,
                    listStyle: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {group.documents.map((document, i) => (
                    <DocumentRowItem
                      key={document.id}
                      document={document}
                      propertyId={view.property.id}
                      first={i === 0}
                    />
                  ))}
                </Box>
              </Stack>
            ))}
          </>
        )}
        {isOwner && view.usage ? (
          <Typography variant="body2" color="text.secondary">
            {m.documents_usage({
              used: formatFileSize(view.usage.bytes),
              limit: formatFileSize(STORAGE_QUOTA.bytes),
            })}
          </Typography>
        ) : null}
        {isOwner ? null : (
          <Typography variant="body2" color="text.secondary">
            {m.documents_member_note()}
          </Typography>
        )}
      </Stack>
      {isOwner ? (
        <Box
          component="footer"
          sx={{
            position: 'sticky',
            bottom: 0,
            px: 2.5,
            pt: 1.5,
            pb: 3.5,
            bgcolor: 'background.default',
            borderTop: `1px solid ${colors.cardBorder}`,
          }}
        >
          <ButtonLink
            to="/properties/$propertyId/documents/new"
            params={{ propertyId: view.property.id }}
            variant="contained"
            fullWidth
            startIcon={<Icon path={PLUS} size={20} />}
            sx={{ minHeight: 56, borderRadius: 999, fontSize: 17 }}
          >
            {m.documents_new()}
          </ButtonLink>
        </Box>
      ) : null}
    </Stack>
  )
}
