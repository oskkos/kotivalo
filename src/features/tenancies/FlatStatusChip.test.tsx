import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { FlatStatusChip } from './FlatStatusChip'

// jsdom's browser language is English, so the chip is in English.

describe('flat status chip', () => {
  test('a let flat shows its tenant', () => {
    render(
      <FlatStatusChip status={{ kind: 'let', tenantName: 'Aino Koski' }} />,
    )
    expect(screen.getByText('Let')).toBeVisible()
    expect(screen.getByText('Aino Koski')).toBeVisible()
  })

  test('notice given shows the last day without the year', () => {
    render(
      <FlatStatusChip
        status={{
          kind: 'notice_given',
          tenantName: 'Aino Koski',
          on: '2026-12-31',
        }}
      />,
    )
    expect(screen.getByText('Notice given · ends 31/12')).toBeVisible()
  })

  test('a vacant flat, with and without a tenant to come', () => {
    const { unmount } = render(
      <FlatStatusChip status={{ kind: 'vacant', nextStart: null }} />,
    )
    expect(screen.getByText('Vacant')).toBeVisible()
    unmount()
    render(
      <FlatStatusChip status={{ kind: 'vacant', nextStart: '2027-01-01' }} />,
    )
    expect(screen.getByText('Vacant · new tenant from 01/01')).toBeVisible()
  })
})
