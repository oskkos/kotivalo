// The flat details page's data in one read (openspec: properties, "The flat
// details page"): one access check, then the flat, its owners, tenancies,
// rent and charges, rent payments and latest entries. Statuses and amounts
// are computed from these by the page with the pure functions of each
// feature, as the other pages do.
import type { OwnershipRepository } from '#/features/ownership/ownership.repository.server'
import type { RentPayment } from '#/features/rent-payments/rent-payment.repository.server'
import type { RentPaymentRepository } from '#/features/rent-payments/rent-payment.repository.server'
import type {
  FeesByTenancy,
  OccupantsByTenancy,
  RentsByTenancy,
} from '#/features/rent-payments/status'
import { accumulatedCapitalised } from '#/features/recurring-amounts/periods'
import type {
  RecurringAmountRepository,
  RecurringAmounts,
} from '#/features/recurring-amounts/recurring-amount.repository.server'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import type {
  Tenancy,
  TenancyRepository,
} from '#/features/tenancies/tenancy.repository.server'
import type {
  TransactionRepository,
  TransactionRow,
} from '#/features/transactions/transaction.repository.server'
import type { UsageChargePeriods } from '#/features/usage-charges/months'
import type { UsageChargeRepository } from '#/features/usage-charges/usage-charge.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { PropertyRole } from '#/server/db/schema'
import type { CardOwner } from './ownership-line'
import type { Property } from './property'
import type { PropertyRepository } from './property.repository.server'

/** How many entries the page lists. */
export const LATEST_ENTRIES = 3

export interface FlatDetailsDeps {
  /** The signed-in user. */
  userId: string
  properties: PropertyRepository
  sharing: SharingRepository
  ownership: OwnershipRepository
  tenancies: TenancyRepository
  amounts: RecurringAmountRepository
  payments: RentPaymentRepository
  transactions: TransactionRepository
  usageCharges: UsageChargeRepository
  now: () => Date
}

export interface FlatDetails extends RecurringAmounts {
  role: PropertyRole
  property: Property
  /** The day in Finland the user archived the flat, or null. */
  archivedOn: IsoDate | null
  /** The current owners, the user as `isYou`. */
  owners: CardOwner[]
  /** Today in Finland. */
  today: IsoDate
  /** Newest first. */
  tenancies: Tenancy[]
  /** Each tenancy's rent periods, oldest first. */
  tenancyRents: RentsByTenancy
  /** Each tenancy's occupants periods, oldest first. */
  tenancyOccupants: OccupantsByTenancy
  /** The flat's usage charges with their periods. */
  usageCharges: UsageChargePeriods[]
  /** Each tenancy's tenant fees. */
  tenancyFees: FeesByTenancy
  /** Cents of financing charges added to the acquisition cost so far. */
  capitalised: number
  payments: RentPayment[]
  /** Newest first. */
  latestEntries: TransactionRow[]
}

const notFound = { ok: false, reason: 'property_not_found' } as const

export async function getFlatDetails(
  deps: FlatDetailsDeps,
  propertyId: string,
): Promise<({ ok: true } & FlatDetails) | typeof notFound> {
  const [role, property] = await Promise.all([
    deps.sharing.roleOf(deps.userId, propertyId),
    deps.properties.findForUser(deps.userId, propertyId),
  ])
  if (!role || !property) {
    return notFound
  }
  const [shares, tenancies, amounts, payments, latestEntries, usageCharges] =
    await Promise.all([
      deps.ownership.currentForUser(deps.userId),
      deps.tenancies.forProperty(propertyId),
      deps.amounts.forProperty(propertyId),
      deps.payments.forProperty(propertyId),
      deps.transactions.latest(propertyId, LATEST_ENTRIES),
      deps.usageCharges.forProperty(propertyId),
    ])
  const today = isoDateInFinland(deps.now())
  const tenancyIds = tenancies.map((t) => t.id)
  const [tenancyRents, tenancyOccupants, tenancyFees] = await Promise.all([
    deps.tenancies.rentsFor(tenancyIds),
    deps.tenancies.occupantsFor(tenancyIds),
    deps.tenancies.feesFor(tenancyIds),
  ])
  return {
    ok: true,
    role,
    property: {
      id: property.id,
      streetAddress: property.streetAddress,
      postcode: property.postcode,
      city: property.city,
      roomCount: property.roomCount,
      floorArea: property.floorArea,
    },
    archivedOn: property.archivedAt
      ? isoDateInFinland(property.archivedAt)
      : null,
    owners: shares
      .filter((share) => share.propertyId === propertyId)
      .map(({ name, share, userId }) => ({
        name,
        share,
        isYou: userId === deps.userId,
      })),
    today,
    tenancies,
    tenancyRents,
    tenancyOccupants,
    tenancyFees,
    usageCharges,
    ...amounts,
    capitalised: accumulatedCapitalised(
      amounts.financingCharges,
      amounts.treatments,
      today,
    ),
    payments,
    latestEntries,
  }
}
