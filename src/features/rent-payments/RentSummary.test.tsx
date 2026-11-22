import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { RentSummary } from './RentSummary'

// jsdom's browser language is English.
describe('The rent summary card', () => {
  test('shows the month, received out of expected and the late count', () => {
    render(
      <RentSummary
        month="2026-11"
        received={64000}
        expected={153000}
        late={1}
      />,
    )
    const summary = screen.getByRole('region', { name: 'November rent' })
    expect(summary).toHaveTextContent('€640.00 / €1,530.00 received')
    expect(summary).toHaveTextContent('Rent late for 1 flat')
  })

  test('leaves the late count out when nothing is late', () => {
    render(
      <RentSummary
        month="2026-11"
        received={89000}
        expected={89000}
        late={0}
      />,
    )
    expect(screen.queryByText(/late/)).toBeNull()
  })
})
