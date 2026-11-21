// Server functions for rent, charges and the financing charge treatment,
// called by the Rent and charges page and its forms. The logic is in
// recurring-amounts.server.ts; these validate the input with the shared
// schemas, check the session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { sharingRepository } from '#/features/sharing/sharing.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import { recurringAmountRepository } from './recurring-amount.repository.server'
import {
  getRecurringAmounts as get,
  setFinancingTreatment as setTreatment,
  setRecurringAmount as setAmount,
  undoFinancingTreatment as undoTreatment,
  undoRecurringAmount as undo,
  type RecurringAmountDeps,
} from './recurring-amounts.server'
import {
  propertyRefInput,
  setAmountInput,
  setTreatmentInput,
  undoAmountInput,
} from './schemas'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function recurringAmountDeps(): Promise<RecurringAmountDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  return {
    userId: session.user.id,
    amounts: recurringAmountRepository(context.db),
    ownership: ownershipRepository(context.db),
    sharing: sharingRepository(context.db),
    log: context.log,
    now: () => new Date(),
  }
}

export const getRecurringAmounts = createServerFn({ method: 'GET' })
  .validator(propertyRefInput)
  .handler(async ({ data }) =>
    get(await recurringAmountDeps(), data.propertyId),
  )

export const setRecurringAmount = createServerFn({ method: 'POST' })
  .validator(setAmountInput)
  .handler(async ({ data }) =>
    setAmount(await recurringAmountDeps(), data.propertyId, {
      kind: data.kind,
      amount: data.amount,
      from: data.from,
    }),
  )

export const undoRecurringAmount = createServerFn({ method: 'POST' })
  .validator(undoAmountInput)
  .handler(async ({ data }) =>
    undo(await recurringAmountDeps(), data.propertyId, data.kind),
  )

export const setFinancingTreatment = createServerFn({ method: 'POST' })
  .validator(setTreatmentInput)
  .handler(async ({ data }) =>
    setTreatment(await recurringAmountDeps(), data.propertyId, {
      treatment: data.treatment,
      from: data.from,
    }),
  )

export const undoFinancingTreatment = createServerFn({ method: 'POST' })
  .validator(propertyRefInput)
  .handler(async ({ data }) =>
    undoTreatment(await recurringAmountDeps(), data.propertyId),
  )
