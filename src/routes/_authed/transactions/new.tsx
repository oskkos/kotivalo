// The new entry form (openspec: transactions, "Logging an entry", "New entry
// from the bottom bar"). With `?propertyId` (from a flat's Entries page) the
// flat is fixed; without it the user picks one of the flats they own.
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { sortByStreetAddress } from '#/features/properties/property'
import { getNewTransactionOptions } from '#/features/transactions/functions'
import { TransactionForm } from '#/features/transactions/TransactionForm'
import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { colors, radii } from '#/theme/tokens'

/** The flat last used for an entry on this device: a convenience only. */
const LAST_FLAT_KEY = 'kotivalo_last_entry_property'

function lastFlat(): string | undefined {
  try {
    return localStorage.getItem(LAST_FLAT_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** The remembered flat changes only by this page's own save. */
const noSubscription = () => () => undefined

function rememberFlat(id: string) {
  try {
    localStorage.setItem(LAST_FLAT_KEY, id)
  } catch {
    // Storage may be blocked; the choice just isn't remembered.
  }
}

export const Route = createFileRoute('/_authed/transactions/new')({
  validateSearch: z.object({ propertyId: z.string().max(64).optional() }),
  loader: () => getNewTransactionOptions(),
  head: () => ({ meta: [{ title: m.transactions_new_page_title() }] }),
  component: NewTransactionRoute,
})

function Explanation(props: { title: string; text: string; noFlats: boolean }) {
  return (
    <Stack sx={{ minHeight: '100dvh', px: 2.5, pt: 6, gap: 2 }}>
      <Stack
        component="main"
        sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: `${String(radii.card)}px`,
          px: 2.5,
          py: 3,
          gap: 1.25,
          textAlign: 'center',
        }}
      >
        <Typography variant="h3" component="h1" sx={{ fontSize: 17 }}>
          {props.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {props.text}
        </Typography>
      </Stack>
      {props.noFlats ? (
        <Button
          component={Link}
          to="/properties/new"
          sx={{ minHeight: 56, borderRadius: 999 }}
        >
          {m.property_add()}
        </Button>
      ) : (
        <Button
          component={Link}
          to="/"
          variant="outlined"
          sx={{ minHeight: 56, borderRadius: 999 }}
        >
          {m.property_back_to_list()}
        </Button>
      )}
    </Stack>
  )
}

function NewTransactionRoute() {
  const options = Route.useLoaderData()
  const { propertyId } = Route.useSearch()
  const router = useRouter()
  const owned = sortByStreetAddress(options.owned, getLocale())
  const fixed = owned.find((flat) => flat.id === propertyId)
  // The server can't see this device's storage: hydration uses the server's
  // value, then the page renders again with the remembered flat.
  const remembered = useSyncExternalStore(
    noSubscription,
    lastFlat,
    () => undefined,
  )
  if (owned.length === 0) {
    return options.hasFlats ? (
      <Explanation
        noFlats={false}
        title={m.transactions_member_only_title()}
        text={m.transactions_member_only_text()}
      />
    ) : (
      <Explanation
        noFlats
        title={m.transactions_no_flats_title()}
        text={m.transactions_no_flats_text()}
      />
    )
  }
  // owned has at least one flat here.
  const initial =
    fixed ?? owned.find((flat) => flat.id === remembered) ?? owned[0]
  return (
    <TransactionForm
      // The form keeps its own flat; a remembered flat found after mount
      // starts it again with that flat.
      key={initial.id}
      flats={fixed ? [fixed] : owned}
      initialFlatId={initial.id}
      pickFlat={!fixed}
      today={options.today}
      onClose={() => {
        if (fixed) {
          void router.navigate({
            to: '/properties/$propertyId/transactions',
            params: { propertyId: fixed.id },
          })
        } else {
          void router.navigate({ to: '/' })
        }
      }}
      onSaved={async (saved) => {
        rememberFlat(saved.propertyId)
        await router.invalidate()
        await router.navigate({
          to: '/properties/$propertyId/transactions',
          params: { propertyId: saved.propertyId },
          search: { year: Number(saved.date.slice(0, 4)) },
        })
      }}
    />
  )
}
