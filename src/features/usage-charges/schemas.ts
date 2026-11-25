// Input for usage charges, shared by the forms and the server functions.
// Errors are reason codes (src/lib/reasons.ts), never text.
import { z } from 'zod'
import {
  monthStartDate,
  typedAmount,
} from '#/features/recurring-amounts/schemas'
import { chargeFields } from '#/lib/charge-fields'

const id = z.string().min(1).max(64)

export const propertyRefInput = z.object({ propertyId: id })

/** A new usage charge with its first amount ("Adding a usage charge"). */
export const addUsageChargeInput = propertyRefInput
  .and(chargeFields)
  .and(z.object({ amount: typedAmount, from: monthStartDate }))

/** A usage charge's new amount from a date ("Changing a usage charge"). */
export const setUsageChargeInput = propertyRefInput.extend({
  chargeId: id,
  amount: typedAmount,
  from: monthStartDate,
})

export const usageChargeRefInput = propertyRefInput.extend({ chargeId: id })
