// The support address as a mailto: link. The address is also the link's text,
// so it can be copied when no mail app opens (openspec: support).
import Link from '@mui/material/Link'
import { supportAddress } from '#/lib/support'
import { getLocale } from '#/paraglide/runtime.js'

export function SupportLink() {
  const address = supportAddress(getLocale())
  return (
    <Link
      href={`mailto:${address}`}
      sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}
    >
      {address}
    </Link>
  )
}
