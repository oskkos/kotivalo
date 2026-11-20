// Flat ownership: the logic behind the server functions in functions.ts,
// with its dependencies passed in so Workers tests can drive it (openspec:
// ownership).
import type {
  Person,
  SharingRepository,
} from '#/features/sharing/sharing.repository.server'
import { isoDateInFinland, type IsoDate } from '#/lib/dates'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import type { OwnershipReason, PropertyRole } from '#/server/db/schema'
import type { Logger } from '#/server/log/log'
import type {
  OwnershipHistory,
  OwnershipRepository,
} from './ownership.repository.server'
import {
  validateChangeDate,
  validateFirstDate,
  validateSplit,
  type Share,
} from './periods'

export interface OwnershipDeps {
  /** The signed-in user. */
  userId: string
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
/** The data changed since it was read; the page reloads it. */
const changedMeanwhile = {
  ok: false,
  reason: 'ownership_invalid',
} as const satisfies Failure

export interface OwnershipView extends OwnershipHistory {
  role: PropertyRole
  /** Everyone with access now, who can be in a new split. */
  people: Person[]
}

/** Checks the user's role; the flat is "not found" without access. */
async function roleCheck(
  deps: OwnershipDeps,
  propertyId: string,
): Promise<typeof notFound | typeof ownerOnly | undefined> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  return role === 'owner' ? undefined : ownerOnly
}

export async function getOwnership(
  deps: OwnershipDeps,
  propertyId: string,
): Promise<({ ok: true } & OwnershipView) | typeof notFound> {
  const role = await deps.sharing.roleOf(deps.userId, propertyId)
  if (!role) {
    return notFound
  }
  const [history, people] = await Promise.all([
    deps.ownership.history(propertyId),
    deps.sharing.listPeople(propertyId),
  ])
  return { ok: true, role, people, ...history }
}

export interface OwnershipChange {
  from: IsoDate
  reason: OwnershipReason
  split: Share[]
  removeAccess: string[]
}

export async function changeOwnership(
  deps: OwnershipDeps,
  propertyId: string,
  change: OwnershipChange,
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const [{ periods }, people] = await Promise.all([
    deps.ownership.history(propertyId),
    deps.sharing.listPeople(propertyId),
  ])
  const withAccess = new Set(people.map((p) => p.userId))
  const sharesOf = new Map(change.split.map((s) => [s.userId, s.share]))
  if (
    change.split.some((s) => !withAccess.has(s.userId)) ||
    change.removeAccess.some((id) => (sharesOf.get(id) ?? 0) > 0)
  ) {
    return changedMeanwhile
  }
  const problem = validateSplit(change.split)
  if (problem) {
    return { ok: false, reason: problem }
  }
  const current = periods.at(0)
  if (!current) {
    return changedMeanwhile
  }
  const dateProblem = validateChangeDate(
    change.from,
    current.validFrom,
    isoDateInFinland(deps.now()),
  )
  if (dateProblem) {
    return { ok: false, reason: dateProblem }
  }
  const applied = await deps.ownership.change({
    propertyId,
    actorId: deps.userId,
    currentStart: current.validFrom,
    from: change.from,
    reason: change.reason,
    split: change.split,
    removeAccess: change.removeAccess,
  })
  if (!applied) {
    return changedMeanwhile
  }
  deps.log.info('ownership.changed', {
    propertyId,
    from: change.from,
    owners: change.split.filter((s) => s.share > 0).length,
    accessRemoved: change.removeAccess.length,
  })
  return { ok: true }
}

export async function undoOwnershipChange(
  deps: OwnershipDeps,
  propertyId: string,
): Promise<{ ok: true } | Failure> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const { periods } = await deps.ownership.history(propertyId)
  const latest = periods.at(0)
  const previous = periods.at(1)
  if (!latest || !previous) {
    return { ok: false, reason: 'ownership_nothing_to_undo' }
  }
  if (
    !(await deps.ownership.undoLatest({
      propertyId,
      actorId: deps.userId,
      latest,
      previous,
    }))
  ) {
    return changedMeanwhile
  }
  deps.log.info('ownership.change_undone', {
    propertyId,
    from: latest.validFrom,
  })
  return { ok: true }
}

export async function correctFirstOwnershipDate(
  deps: OwnershipDeps,
  propertyId: string,
  date: IsoDate,
): Promise<{ ok: true } | Failure<FieldReason | AlertReason>> {
  const refused = await roleCheck(deps, propertyId)
  if (refused) {
    return refused
  }
  const { periods } = await deps.ownership.history(propertyId)
  const first = periods.at(-1)
  if (!first) {
    return changedMeanwhile
  }
  const problem = validateFirstDate(
    date,
    periods.at(-2)?.validFrom,
    isoDateInFinland(deps.now()),
  )
  if (problem) {
    return { ok: false, reason: problem }
  }
  if (
    !(await deps.ownership.correctFirstDate({
      propertyId,
      actorId: deps.userId,
      firstStart: first.validFrom,
      date,
    }))
  ) {
    return changedMeanwhile
  }
  deps.log.info('ownership.first_date_corrected', { propertyId })
  return { ok: true }
}
