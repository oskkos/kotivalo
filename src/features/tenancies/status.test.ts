import { describe, expect, test } from 'vitest'
import {
  currentTenancy,
  dueDate,
  flatStatus,
  tenancyStatus,
  type StatusTenancy,
} from './status'

const ended: StatusTenancy = {
  contractType: 'open_ended',
  validFrom: '2025-03-01',
  validTo: '2026-12-31',
  termEnd: null,
  noticeGivenBy: 'tenant',
  noticeDate: '2026-11-22',
}

const fixedTerm: StatusTenancy = {
  contractType: 'fixed_term',
  validFrom: '2027-01-01',
  validTo: '2027-12-31',
  termEnd: '2027-12-31',
  noticeGivenBy: null,
  noticeDate: null,
}

describe('Tenancy statuses', () => {
  test('Statuses through an ended tenancy', () => {
    expect(tenancyStatus(ended, '2025-02-28')).toEqual({
      kind: 'starts',
      on: '2025-03-01',
    })
    expect(tenancyStatus(ended, '2026-11-21')).toEqual({ kind: 'active' })
    expect(tenancyStatus(ended, '2026-12-31')).toEqual({
      kind: 'notice_given',
      on: '2026-12-31',
    })
    expect(tenancyStatus(ended, '2027-01-01')).toEqual({
      kind: 'ended',
      on: '2026-12-31',
    })
    expect(flatStatus([ended], '2027-01-01')).toEqual({
      kind: 'vacant',
      next: null,
      since: '2026-12-31',
    })
  })

  test('A fixed-term tenancy shows when it ends', () => {
    expect(tenancyStatus(fixedTerm, '2027-06-01')).toEqual({
      kind: 'ends',
      on: '2027-12-31',
    })
    expect(tenancyStatus(fixedTerm, '2028-01-01')).toEqual({
      kind: 'ended',
      on: '2027-12-31',
    })
  })
})

describe('tenancy statuses', () => {
  test('a flat is let, given notice or vacant with the next tenancy', () => {
    expect(flatStatus([ended], '2026-11-21')).toEqual({
      kind: 'let',
      tenancy: ended,
    })
    expect(flatStatus([ended, fixedTerm], '2026-12-01')).toEqual({
      kind: 'notice_given',
      tenancy: ended,
      on: '2026-12-31',
    })
    expect(flatStatus([fixedTerm], '2026-12-01')).toEqual({
      kind: 'vacant',
      next: fixedTerm,
      since: null,
    })
    expect(flatStatus([], '2026-12-01')).toEqual({
      kind: 'vacant',
      next: null,
      since: null,
    })
  })

  test('a fixed term ended early shows notice given until its last day', () => {
    const early = {
      ...fixedTerm,
      validTo: '2027-06-30',
      noticeGivenBy: 'agreed' as const,
      noticeDate: '2027-05-15',
    }
    expect(tenancyStatus(early, '2027-05-01')).toEqual({
      kind: 'ends',
      on: '2027-12-31',
    })
    expect(tenancyStatus(early, '2027-05-15')).toEqual({
      kind: 'notice_given',
      on: '2027-06-30',
    })
  })
})

describe('Tenancy dates and details', () => {
  test('The due day falls on the last day of a short month', () => {
    expect(dueDate(31, '2027-02')).toBe('2027-02-28')
    expect(dueDate(31, '2027-04')).toBe('2027-04-30')
    expect(dueDate(5, '2027-02')).toBe('2027-02-05')
  })
})

describe('the current tenancy', () => {
  test('is the running one, else the next to start', () => {
    expect(currentTenancy([fixedTerm, ended], '2026-12-01')).toBe(ended)
    expect(currentTenancy([fixedTerm, ended], '2027-01-01')).toBe(fixedTerm)
    expect(currentTenancy([ended], '2027-01-01')).toBeNull()
  })
})
