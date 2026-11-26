// Server functions for the year summary page and a flat's form 7H page. The
// logic is in year-summary.server.ts; these validate the input, check the
// session and wire in the request context.
import { createServerFn } from '@tanstack/react-start'
import { ownershipRepository } from '#/features/ownership/ownership.repository.server'
import { depositReturnRepository } from '#/features/deposits/deposit-return.repository.server'
import { propertyRepository } from '#/features/properties/property.repository.server'
import { recurringAmountRepository } from '#/features/recurring-amounts/recurring-amount.repository.server'
import { rentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import { tenancyRepository } from '#/features/tenancies/tenancy.repository.server'
import { transactionRepository } from '#/features/transactions/transaction.repository.server'
import { usageChargeRepository } from '#/features/usage-charges/usage-charge.repository.server'
import { getRequestContext } from '#/server/platform/context.server'
import { flatYearInput, yearSummaryInput } from './schemas'
import {
  loadFlatYear,
  loadYearSummary,
  type YearSummaryDeps,
} from './year-summary.server'

/**
 * The signed-in user's dependencies. Pages are protected by the signed-in
 * layout, endpoints are not: without a session this throws.
 */
async function yearSummaryDeps(): Promise<YearSummaryDeps> {
  const context = getRequestContext()
  const session = await context.auth.getSession()
  if (!session) {
    throw new Error('Not signed in')
  }
  const { db } = context
  return {
    userId: session.user.id,
    properties: propertyRepository(db),
    ownership: ownershipRepository(db),
    tenancies: tenancyRepository(db),
    payments: rentPaymentRepository(db),
    depositReturns: depositReturnRepository(db),
    transactions: transactionRepository(db),
    amounts: recurringAmountRepository(db),
    usageCharges: usageChargeRepository(db),
    now: () => new Date(),
  }
}

export const getYearSummary = createServerFn({ method: 'GET' })
  .validator(yearSummaryInput)
  .handler(async ({ data }) =>
    loadYearSummary(await yearSummaryDeps(), data.year, data.person),
  )

export const getFlatYear = createServerFn({ method: 'GET' })
  .validator(flatYearInput)
  .handler(async ({ data }) =>
    loadFlatYear(
      await yearSummaryDeps(),
      data.propertyId,
      data.year,
      data.person,
    ),
  )
