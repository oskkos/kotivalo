// The current tenancy's lease on the Tenancy page (openspec: documents,
// "The lease on the tenancy page"): the leases naming it, each opening its
// details page, or a note that the signed lease can be kept with the flat's
// documents. Owners get the add action from the route.
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import type { DocumentRow } from '#/features/documents/document.repository.server'
import { formatDate } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'

interface Props {
  leases: readonly DocumentRow[]
  /** Wraps a lease's row in a link to its details page. */
  link: (lease: DocumentRow, row: ReactNode) => ReactNode
  /** Owners only: the link that adds a lease. */
  add?: ReactNode
}

export function LeaseCard(props: Props) {
  return (
    <Stack
      component="section"
      aria-labelledby="lease-title"
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: `${String(radii.card)}px`,
        gap: 0.75,
        px: 2,
        py: 1.75,
      }}
    >
      <Typography
        id="lease-title"
        component="h2"
        sx={{ fontSize: 15, fontWeight: 900 }}
      >
        {m.lease_card_title()}
      </Typography>
      {props.leases.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {m.lease_card_none()}
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {props.leases.map((lease, i) => (
            <Box
              key={lease.id}
              component="li"
              sx={{
                borderTop: i === 0 ? 'none' : `1px solid ${colors.divider}`,
              }}
            >
              {props.link(
                lease,
                <Stack sx={{ minHeight: 56, justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 900 }}>
                    {lease.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {m.lease_card_line({
                      date: formatDate(lease.date),
                      type:
                        lease.contentType === 'application/pdf'
                          ? m.documents_type_pdf()
                          : m.documents_type_image(),
                    })}
                  </Typography>
                </Stack>,
              )}
            </Box>
          ))}
        </Box>
      )}
      {props.add}
    </Stack>
  )
}
