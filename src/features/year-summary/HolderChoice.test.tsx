import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { HolderChoice } from './HolderChoice'
import type { YearSummaryView } from './view'

// jsdom's browser language is English.
const people: YearSummaryView['people'] = [
  { userId: 'jussi', name: 'Jussi Laine', flats: 1 },
  { userId: 'mikko', name: 'Mikko Virtanen', flats: 2 },
]
const counts = { own: 2, whole: 3 }

function renderChoice(holder: YearSummaryView['holder'] = { kind: 'own' }) {
  const onChoose = vi.fn()
  render(
    <HolderChoice
      holder={holder}
      people={people}
      counts={counts}
      onChoose={onChoose}
    />,
  )
  return onChoose
}

describe('Choosing whose figures', () => {
  test('The sheet lists the own share, the owners and the whole flats', async () => {
    renderChoice()
    await userEvent.click(screen.getByRole('button', { name: /Whose figures/ }))
    const sheet = screen.getByRole('dialog')
    const options = within(sheet).getAllByRole('radio')
    expect(options.map((o) => o.getAttribute('value'))).toEqual([
      'own',
      'jussi',
      'mikko',
      'whole',
    ])
    expect(
      within(sheet).getByRole('radio', { name: /Your own share/ }),
    ).toBeChecked()
    expect(within(sheet).getByText('Mikko Virtanen')).toBeVisible()
    expect(within(sheet).getAllByText('2 flats')).toHaveLength(2)
    expect(within(sheet).getByText('Whole flats (100%)')).toBeVisible()
  })

  test('the chosen person is shown on the button and checked in the sheet', async () => {
    renderChoice({ kind: 'person', userId: 'mikko', name: 'Mikko Virtanen' })
    expect(screen.getByRole('button', { name: /Mikko Virtanen/ })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /Whose figures/ }))
    expect(screen.getByRole('radio', { name: /Mikko Virtanen/ })).toBeChecked()
  })

  test('choosing a person reports their id, the own share none', async () => {
    const onChoose = renderChoice({ kind: 'whole' })
    await userEvent.click(screen.getByRole('button', { name: /Whose figures/ }))
    await userEvent.click(screen.getByRole('radio', { name: /Jussi Laine/ }))
    expect(onChoose).toHaveBeenLastCalledWith('jussi')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /Whose figures/ }))
    await userEvent.click(screen.getByRole('radio', { name: /Your own share/ }))
    expect(onChoose).toHaveBeenLastCalledWith(undefined)
  })
})
