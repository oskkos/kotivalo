import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createProperty } from '#/features/properties/functions'
import {
  EMPTY_PROPERTY,
  PropertyForm,
} from '#/features/properties/PropertyForm'
import { m } from '#/paraglide/messages.js'

export const Route = createFileRoute('/_authed/properties/new')({
  head: () => ({ meta: [{ title: m.property_new_page_title() }] }),
  component: NewPropertyRoute,
})

function NewPropertyRoute() {
  const router = useRouter()
  const toList = () => {
    void router.navigate({ to: '/' })
  }
  return (
    <PropertyForm
      title={m.property_new_title()}
      initial={EMPTY_PROPERTY}
      save={(details) => createProperty({ data: details })}
      onSaved={() => {
        void router.invalidate().then(toList)
      }}
      onClose={toList}
    />
  )
}
