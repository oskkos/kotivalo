import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { ImageViewer } from './ImageViewer'

const props = {
  src: '/api/documents/d1',
  downloadHref: '/api/documents/d1?download=1',
  filename: 'vastikkeet.jpg',
  title: 'Document',
  alt: 'Image of vastikkeet.jpg',
  closeLabel: 'Close',
  downloadLabel: 'Download',
  open: true,
  onClose: vi.fn(),
}

describe('ImageViewer', () => {
  test('shows the image, the file name, Close and Download', () => {
    render(<ImageViewer {...props} />)
    expect(screen.getByRole('img', { name: props.alt })).toHaveAttribute(
      'src',
      props.src,
    )
    expect(screen.getByText('vastikkeet.jpg')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      props.downloadHref,
    )
  })

  test('Close asks to close', async () => {
    const onClose = vi.fn()
    render(<ImageViewer {...props} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  test('shows nothing while closed', () => {
    render(<ImageViewer {...props} open={false} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
