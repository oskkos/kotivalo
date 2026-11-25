import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { FileField } from './FileField'

const labels = {
  attach: 'Attach',
  hint: 'Photo or PDF',
  saving: 'Saving',
  remove: 'Remove file',
  replace: 'Replace',
}

const props = {
  title: 'Receipt',
  file: undefined,
  reason: undefined,
  submitting: false,
  onChoose: vi.fn(),
  onRemove: vi.fn(),
  labels,
}

const pdf = new File([new Uint8Array(2048)], 'kuitti.pdf', {
  type: 'application/pdf',
})

describe('FileField', () => {
  test('shows one button, and passes on the chosen file', async () => {
    const onChoose = vi.fn()
    render(<FileField {...props} onChoose={onChoose} />)
    expect(screen.getByRole('button', { name: /Attach/ })).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Attach'), pdf)
    expect(onChoose).toHaveBeenCalledWith(pdf)
  })

  test("shows the chosen file's name and size, and removes it", async () => {
    const onRemove = vi.fn()
    render(<FileField {...props} file={pdf} onRemove={onRemove} />)
    expect(screen.getByText('kuitti.pdf')).toBeInTheDocument()
    expect(screen.getByText(/2/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove file' }))
    expect(onRemove).toHaveBeenCalled()
  })

  test('says Saving instead of the size while submitting', () => {
    render(<FileField {...props} file={pdf} submitting />)
    expect(screen.getByText('Saving')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove file' })).toBeDisabled()
  })

  test('shows a file the record already has, with Replace and Remove', async () => {
    const onRemoveKept = vi.fn()
    render(
      <FileField
        {...props}
        kept={{ filename: 'vanha.jpg', size: 1000 }}
        onRemoveKept={onRemoveKept}
      />,
    )
    expect(screen.getByText('vanha.jpg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove file' }))
    expect(onRemoveKept).toHaveBeenCalled()
  })

  test('shows the reason under the button', () => {
    render(<FileField {...props} reason="receipt_too_large" />)
    expect(screen.getByText(/10 Mt|10 MB/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Attach/ })).toHaveAttribute(
      'aria-describedby',
    )
  })
})
