// Rent, charges and the financing charge treatment: the logic behind the
// server functions in functions.ts, with its dependencies passed in so
// Workers tests can drive it (openspec: recurring-amounts).
import type { OwnershipRepository } from '#/features/ownership/ownership.repository.server'
import type { SharingRepository } from '#/features/sharing/sharing.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type {
  FinancingTreatment,
  PropertyRole,
  RecurringAmountKind,
} from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import { accumulatedCapitalised, validateAmountDate } from './periods'
import type {
  RecurringAmountRepository,
  RecurringAmounts,
} from './recurring-amount.repository.server'

export interface RecurringAmountDeps {
  /** The signed-in user. */
  userId: string
  amounts: RecurringAmountRepository
  ownership: OwnershipRepository
  sharing: SharingRepository
  log: Logger
  now: () => Date
}

interface Failure<R extends FieldReason | AlertReason = AlertReason> {
  ok: false
  reason: R
}

const notFound = {
  ok: false,
  reason: 'property_not_found',
} as const satisfies Failure
const ownerOnly = {
  ok: false,
  reason: 'sharing_owner_only',
} as const satisfies Failure
const changedMeanwhile = {
  ok: false,
  reason: 'amount_changed',
} as const satisfies Failure

export interface RecurringAmountsView extends RecurringAmounts {
  role: PropertyRole
  /** Today in Finland, so the page and the server agree on "current". */
  today: IsoDate
  /** The start of the flat's first ownership period. */
  ownershipStart: IsoDate
  /** Financing charges capitalised so far, in cents. */
  capitalised: number
}

/** Checks the user's role; the flat is "not found" without access. */
async function roleCheck(
  deps: RecurringAmountDeps,
  propertyId: string,
): Promise<typeof notFound | typeof ownerOnly | undefined> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

async function ownershipStart(
  deps: RecurringAmountDeps,
  propertyId: string,
): Promise<IsoDate | undefined> {
  const { periods } = await deps.ownership.history(propertyId)
  return periods.at(-1)?.validFrom
}

export async function getRecurringAmounts(
  deps: RecurringAmountDeps,
  propertyId: string,
): Promise<({ ok: true } & RecurringAmountsView) | typeof notFound> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  const [data, start] = await Promise.all([
    deps.amounts.forProperty(propertyId),
    ownershipStart(deps, propertyId),
  ])
  const today = isoDateInFinland(deps.now())
  return {
    ok: true,
    ...data,
    role,
    today,
    ownershipStart: start ?? today,
    capitalised: accumulatedCapitalised(
      data.amounts.financing_charge,
      data.treatments,
      today,
    ),
  }
}

/** Checks a start date against the flat's ownership and latest period. */
async function dateProblem(
  deps: RecurringAmountDeps,
  propertyId: string,
  from: IsoDate,
  latestStart: IsoDate | undefined,
): Promise<Failure<FieldReason> | typeof changedMeanwhile | undefined> {
  const start = await ownershipStart(deps, propertyId)
  if (!start) {
    return changedMeanwhile
  }
  const problem = validateAmountDate(from, {
    ownershipStart: start,
    latestStart,
  })
  return problem ? { ok: false, reason: problem } : undefined
}

export async function setRecurringAmount(
  deps: RecurringAmountDeps,
  propertyId: string,
  change: { kind: RecurringAmountKind; amount: number; from: IsoDate },
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const { amounts } = await deps.amounts.forProperty(propertyId)
  const latestStart = amounts[change.kind].at(-1)?.validFrom
  const problem = await dateProblem(deps, propertyId, change.from, latestStart)
  if (problem) {
    return problem
  }
  const applied = await deps.amounts.setAmount({
    propertyId,
    actorId: deps.userId,
    kind: change.kind,
    amount: change.amount,
    from: change.from,
    latestStart: latestStart ?? null,
  })
  if (!applied) {
    return changedMeanwhile
  }
  deps.log.info('recurring_amount.set', {
    propertyId,
    kind: change.kind,
    from: change.from,
    corrected: change.from === latestStart,
  })
  return { ok: true }
}

export async function undoRecurringAmount(
  deps: RecurringAmountDeps,
  propertyId: string,
  kind: RecurringAmountKind,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const periods = (await deps.amounts.forProperty(propertyId)).amounts[kind]
  const latest = periods.at(-1)
  if (!latest) {
    return { ok: false, reason: 'amount_nothing_to_undo' }
  }
  const applied = await deps.amounts.undoLatestAmount({
    propertyId,
    actorId: deps.userId,
    kind,
    latestStart: latest.validFrom,
    previousStart: periods.at(-2)?.validFrom ?? null,
  })
  if (!applied) {
    return changedMeanwhile
  }
  deps.log.info('recurring_amount.undone', {
    propertyId,
    kind,
    from: latest.validFrom,
  })
  return { ok: true }
}

export async function setFinancingTreatment(
  deps: RecurringAmountDeps,
  propertyId: string,
  change: { treatment: FinancingTreatment; from: IsoDate },
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const { treatments } = await deps.amounts.forProperty(propertyId)
  const latestStart = treatments.at(-1)?.validFrom
  const problem = await dateProblem(deps, propertyId, change.from, latestStart)
  if (problem) {
    return problem
  }
  const applied = await deps.amounts.setTreatment({
    propertyId,
    actorId: deps.userId,
    treatment: change.treatment,
    from: change.from,
    latestStart: latestStart ?? null,
  })
  if (!applied) {
    return changedMeanwhile
  }
  deps.log.info('financing_treatment.set', {
    propertyId,
    from: change.from,
    corrected: change.from === latestStart,
  })
  return { ok: true }
}

export async function undoFinancingTreatment(
  deps: RecurringAmountDeps,
  propertyId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const { treatments } = await deps.amounts.forProperty(propertyId)
  const latest = treatments.at(-1)
  if (!latest) {
    return { ok: false, reason: 'treatment_nothing_to_undo' }
  }
  const applied = await deps.amounts.undoLatestTreatment({
    propertyId,
    actorId: deps.userId,
    latestStart: latest.validFrom,
    previousStart: treatments.at(-2)?.validFrom ?? null,
  })
  if (!applied) {
    return changedMeanwhile
  }
  deps.log.info('financing_treatment.undone', {
    propertyId,
    from: latest.validFrom,
  })
  return { ok: true }
}
