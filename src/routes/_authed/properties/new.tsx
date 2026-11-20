import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { createProperty } from '#/features/properties/functions'
import {
  EMPTY_PROPERTY,
  PropertyForm,
} from '#/features/properties/PropertyForm'
import { isoDateInFinland } from '#/lib/dates'
import { formatDate } from '#/lib/format'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/new')({
  head: () => ({ meta: [{ title: m.property_new_page_title() }] }),
  component: NewPropertyRoute,
})

function NewPropertyRoute() {
  const router = useRouter()
  // Owned since today, unless changed.
  const [today] = useState(() => formatDate(isoDateInFinland(new Date())))
  const toList = () => {
    void router.navigate({ to: '/' })
  }
  return (
    <PropertyForm
      title={m.property_new_title()}
      initial={{ ...EMPTY_PROPERTY, ownedSince: today }}
      save={(details) => createProperty({ data: details })}
      onSaved={() => {
        void router.invalidate().then(toList)
      }}
      onClose={toList}
    />
  )
}
