/* eslint-disable import/first */
// redesign SC-B4: the viewer of the label sheet keeps its behavior (pdf.js, zoom, note, slot of actions) and changes only its dress:
// P/IconButton for the zoom, the percentage as a figure, P/Skeleton and P/EmptyState for loading and failure.
// pdf.js is replaced by a one-page document; no real file is read.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text]
}))

const renderPage = vi.fn(() => ({ promise: Promise.resolve() }))
const fakeDocument = {
  numPages: 2,
  getPage: async () => ({
    getViewport: ({ scale }) => ({ width: 100 * scale, height: 140 * scale }),
    render: renderPage
  })
}

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve(fakeDocument), destroy: () => {} })
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'pdf.worker.js' }))

import { PdfPreview } from '../PdfPreview'

const fakeBlob = { arrayBuffer: async () => new ArrayBuffer(8) }

beforeEach(() => {
  renderPage.mockClear()
  // jsdom has no canvas: the pages are drawn by the double above, the canvas only has to exist
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PdfPreview', () => {
  it('draws the note, the slot of actions and the zoom as named icon buttons with the percentage as a figure', () => {
    render(<PdfPreview blob={null} note='Guides are shown' actions={<button type='button'>Download</button>} zoom={1.5} />)
    expect(screen.getByText('Guides are shown')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveAttribute('data-icon-only')
    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveAttribute('data-icon-only')
    expect(screen.getByText('150%')).toHaveClass('odc-figure')
  })

  it('has nothing to zoom until a document is loaded', () => {
    render(<PdfPreview blob={null} />)
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
  })

  it('loads the document, draws its pages and zooms by quarters inside its limits', async () => {
    const onZoomChange = vi.fn()
    const { rerender } = render(<PdfPreview blob={fakeBlob} zoom={1} onZoomChange={onZoomChange} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled())
    await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(onZoomChange).toHaveBeenLastCalledWith(1.25)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(onZoomChange).toHaveBeenLastCalledWith(0.75)

    rerender(<PdfPreview blob={fakeBlob} zoom={0.5} onZoomChange={onZoomChange} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled())
    rerender(<PdfPreview blob={fakeBlob} zoom={4} onZoomChange={onZoomChange} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled())
  })

  it('shows a skeleton and is busy while the sheet loads', () => {
    render(<PdfPreview blob={null} loading />)
    expect(document.querySelector('.odc-skeleton')).not.toBeNull()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('a failure is an announced error with its message, in the viewer', () => {
    render(<PdfPreview blob={null} error='The sheet could not be built' />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-tone', 'error')
    expect(alert).toHaveTextContent('The sheet could not be built')
  })

  it('the pages cannot be saved from the context menu (as before)', async () => {
    render(<PdfPreview blob={fakeBlob} zoom={1} />)
    await waitFor(() => expect(renderPage).toHaveBeenCalled())
    const pages = document.querySelector('.odc-school-labels-pages')
    expect(pages).not.toBeNull()
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    pages.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
