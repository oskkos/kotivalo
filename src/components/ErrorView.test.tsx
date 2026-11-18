import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { clientLog } from '#/lib/client-log'
import { browserTraceId } from '#/lib/trace'
import { ErrorView } from './ErrorView'

vi.mock('#/lib/client-log', () => ({ clientLog: { error: vi.fn() } }))

// jsdom's browser language is English.
describe('Showing a reference with an unexpected error', () => {
  test('A page that fails to render shows a reference', () => {
    const error = new Error('render failed')
    render(<ErrorView error={error} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong')
    expect(alert).toHaveTextContent(
      `Error reference: ${String(browserTraceId()?.slice(0, 8))}`,
    )
    expect(clientLog.error).toHaveBeenCalledWith('app.render_error', {}, error)
  })
})
