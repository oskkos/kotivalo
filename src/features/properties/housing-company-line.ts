// The housing company line on the flat details page's header card: the
// details that are filled in, joined with " · " (openspec: properties,
// "Housing company details of a flat").
import { m } from '#/paraglide/messages.js'
import type { PropertyDetails } from './property'

/** Empty when the flat has none of the three details. */
export function housingCompanyLine(
  details: Pick<
    PropertyDetails,
    'housingCompanyName' | 'apartmentNumber' | 'businessId'
  >,
): string {
  const parts: string[] = []
  if (details.housingCompanyName) {
    parts.push(details.housingCompanyName)
  }
  if (details.apartmentNumber) {
    parts.push(m.property_apartment_line({ number: details.apartmentNumber }))
  }
  if (details.businessId) {
    parts.push(m.property_business_id_line({ id: details.businessId }))
  }
  return parts.join(' · ')
}
