import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { clientLog } from '#/lib/client-log'
import { PdfButton } from './PdfButton'
import type { YearSummaryPdfView } from './view'

vi.mock('./functions', () => ({ getYearSummaryPdf: vi.fn() }))

// jsdom's browser language is English.
const pdfView = (
  over: Partial<YearSummaryPdfView> = {},
): YearSummaryPdfView => ({
  holder: { kind: 'own' },
  holderName: 'Annika Kotivalo',
  today: '2026-11-27',
  year: 2025,
  cards: [],
  notIncluded: [],
  flats: [],
  ...over,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Downloading the year summary as a PDF', () => {
  test("Downloading the own share's PDF", async () => {
    const load = vi.fn().mockResolvedValue(pdfView())
    const build = vi.fn().mockResolvedValue(new Blob(['%PDF']))
    const save = vi.fn()
    render(
      <PdfButton
        year={2025}
        person={undefined}
        load={load}
        build={build}
        save={save}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(load).toHaveBeenCalledWith({ year: 2025, person: undefined })
    expect(save).toHaveBeenCalledWith(
      expect.any(Blob),
      'kotivalo-year-summary-2025.pdf',
    )
    expect(
      await screen.findByText('Downloaded: kotivalo-year-summary-2025.pdf'),
    ).toBeVisible()
  })

  test('The PDF follows the chosen holder', async () => {
    const load = vi
      .fn()
      .mockResolvedValue(pdfView({ holder: { kind: 'whole' }, holderName: '' }))
    const save = vi.fn()
    render(
      <PdfButton
        year={2025}
        person="whole"
        load={load}
        build={() => Promise.resolve(new Blob())}
        save={save}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(load).toHaveBeenCalledWith({ year: 2025, person: 'whole' })
    expect(save).toHaveBeenCalledWith(
      expect.any(Blob),
      'kotivalo-year-summary-2025-whole-flats.pdf',
    )
  })

  test('The button is disabled while the PDF is made', async () => {
    let finish: (view: YearSummaryPdfView) => void = () => undefined
    const load = () =>
      new Promise<YearSummaryPdfView>((resolve) => {
        finish = resolve
      })
    render(
      <PdfButton
        year={2025}
        person={undefined}
        load={load}
        build={() => Promise.resolve(new Blob())}
        save={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(
      screen.getByRole('button', { name: 'Creating the PDF…' }),
    ).toBeDisabled()
    finish(pdfView())
    expect(
      await screen.findByRole('button', { name: 'Download PDF' }),
    ).toBeEnabled()
  })

  test('Building the PDF fails', async () => {
    const log = vi.spyOn(clientLog, 'error').mockImplementation(() => undefined)
    const build = vi
      .fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue(new Blob())
    const save = vi.fn()
    render(
      <PdfButton
        year={2025}
        person={undefined}
        load={() => Promise.resolve(pdfView())}
        build={build}
        save={save}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(await screen.findByText('The PDF could not be made.')).toBeVisible()
    expect(save).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(
      'year_summary.pdf_failed',
      {},
      expect.any(Error),
    )
    // The button works again.
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByText('The PDF could not be made.')).toBeNull()
  })
})
