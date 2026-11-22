// Tenancy words in the user's language: statuses, contract types and how a
// tenancy was ended.
import { formatDate } from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import type { ContractType, NoticeGiver } from '#/server/db/schema'
import type { TenancyStatus } from './status'

export function statusLabel(status: TenancyStatus): string {
  switch (status.kind) {
    case 'starts':
      return m.tenancy_status_starts({ date: formatDate(status.on) })
    case 'active':
      return m.tenancy_status_active()
    case 'ends':
      return m.tenancy_status_ends({ date: formatDate(status.on) })
    case 'notice_given':
      return m.tenancy_status_notice_given({ date: formatDate(status.on) })
    case 'ended':
      return m.tenancy_status_ended({ date: formatDate(status.on) })
  }
}

export const contractLabel: Record<ContractType, () => string> = {
  open_ended: () => m.tenancy_contract_open_ended(),
  fixed_term: () => m.tenancy_contract_fixed_term(),
}

export const contractShortLabel: Record<ContractType, () => string> = {
  open_ended: () => m.tenancy_contract_short_open_ended(),
  fixed_term: () => m.tenancy_contract_fixed_term(),
}

export const endingLabel: Record<NoticeGiver, () => string> = {
  tenant: () => m.tenancy_by_tenant(),
  landlord: () => m.tenancy_by_landlord(),
  agreed: () => m.tenancy_by_agreed(),
  court: () => m.tenancy_by_court(),
  other: () => m.tenancy_by_other(),
}

/** A tenancy's dates: `1.3.2025–31.12.2026`, or `1.3.2025 alkaen`. */
export function datesLabel(validFrom: string, validTo: string | null): string {
  return validTo === null
    ? m.tenancy_dates_open({ from: formatDate(validFrom) })
    : m.tenancy_dates({ from: formatDate(validFrom), to: formatDate(validTo) })
}
