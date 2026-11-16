/* eslint-disable import/first */
// redesign stores 5.3: Store details › Images. Covered: several files go up one after another and end in one summary
// (added count, and per file why one was not: type, size, the API); «Add images» is a named button; thumbnails have an alt (G2-42);
// delete asks first and a failed delete says why (G2-16); a notice never re-opens on its own (G2-15); «Drag and Drop» (G2-17).
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ add: null, remove: null, deletingId: null }))

const gallery = vi.hoisted(() => ({
  BusinessGallery: ({ UIComponent, ...props }) => {
    const photos = (props.business?.gallery || []).filter(item => item.file)
    return (
      <UIComponent
        {...props}
        businessPhotos={photos}
        businessVideos={[]}
        deletingId={probe.deletingId}
        handleAddGalleryItem={(...args) => probe.add(...args)}
        handleDeleteBusinessGallery={(...args) => probe.remove(...args)}
      />
    )
  }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }],
  BusinessGallery: gallery.BusinessGallery
}))
vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }],
  BusinessGallery: gallery.BusinessGallery
}))

import { BusinessImages } from '../index'

const STORE = {
  id: 2,
  name: 'Fast Bite',
  gallery: [
    { id: 1, file: 'https://img.test/1.png' },
    { id: 2, file: 'https://img.test/2.png' },
    { id: 7, video: 'https://youtu.be/abc' }
  ]
}

const png = (name, size = 1000) => new File([new Uint8Array(size)], name, { type: 'image/png' })

class ReaderStub {
  readAsDataURL (file) {
    this.result = `data:${file.type};base64,${file.name}`
    setTimeout(() => this.onload && this.onload())
  }
}

beforeEach(() => {
  probe.add = vi.fn().mockResolvedValue({ ok: true, result: {} })
  probe.remove = vi.fn().mockResolvedValue({ ok: true })
  probe.deletingId = null
  vi.stubGlobal('FileReader', ReaderStub)
  window.FileReader = ReaderStub
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const pick = async (files) => {
  const input = screen.getByTestId('gallery-file-input')
  await act(async () => {
    fireEvent.change(input, { target: { files } })
  })
  await uploadsFinished()
}

// The summary appears once every queued upload is done. A fixed sleep was flaky under full-suite load.
const uploadsFinished = () => waitFor(() => expect(screen.getAllByText(/added/).length).toBeGreaterThan(0))

describe('Store details › Images', () => {
  it('shows «Drag and Drop» spelled right and a named «Add images» button', () => {
    render(<BusinessImages business={STORE} />)
    expect(screen.getByText('Drag and Drop')).toBeTruthy()
    expect(screen.queryByText(/Darg/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Add images' })).toBeTruthy()
    expect(screen.getByTestId('gallery-file-input').multiple).toBe(true)
  })

  it('gives every thumbnail an alt and every delete a name (G2-42)', () => {
    render(<BusinessImages business={STORE} />)
    const list = screen.getByRole('list', { name: 'Images' })
    const images = within(list).getAllByRole('img')
    expect(images.map(img => img.getAttribute('alt'))).toEqual(['Image 1 of 2', 'Image 2 of 2'])
    expect(screen.getByRole('button', { name: 'Delete image 2' })).toBeTruthy()
  })

  it('uploads several images one after another and says how many were added', async () => {
    render(<BusinessImages business={STORE} />)
    await pick([png('a.png'), png('b.png'), png('c.png')])
    expect(probe.add).toHaveBeenCalledTimes(3)
    expect(probe.add.mock.calls.map(call => call[0].file)).toEqual([
      'data:image/png;base64,a.png', 'data:image/png;base64,b.png', 'data:image/png;base64,c.png'
    ])
    expect(probe.add.mock.calls[0][1]).toEqual({ silent: true })
    expect(screen.getByText('3 images added')).toBeTruthy()
  })

  it('names each file that was not added and why, and still adds the rest', async () => {
    probe.add = vi.fn()
      .mockResolvedValueOnce({ ok: true, result: {} })
      .mockResolvedValueOnce({ ok: false, error: 'Quota exceeded' })
    render(<BusinessImages business={STORE} />)
    const text = new File(['x'], 'notes.txt', { type: 'text/plain' })
    const big = png('huge.png', 3 * 1024 * 1024)
    await pick([png('ok.png'), text, big, png('fails.png')])
    expect(probe.add).toHaveBeenCalledTimes(2)
    const notice = screen.getByText('3 images could not be added:').closest('[role="status"]')
    expect(within(notice).getByText('1 image added', { exact: false })).toBeTruthy()
    const items = within(notice).getAllByRole('listitem').map(li => li.textContent)
    expect(items).toEqual([
      'notes.txt: Only images can be accepted',
      'huge.png: The maximum image size is 2 megabytes',
      'fails.png: Quota exceeded'
    ])
  })

  it('takes files dropped on the zone', async () => {
    render(<BusinessImages business={STORE} />)
    const zone = screen.getByText('Drag and Drop').parentElement
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [png('d1.png'), png('d2.png')], types: ['Files'] } })
    })
    await uploadsFinished()
    expect(probe.add).toHaveBeenCalledTimes(2)
    expect(screen.getByText('2 images added')).toBeTruthy()
  })

  it('deletes after a confirmation that shows the image', async () => {
    const user = userEvent.setup()
    render(<BusinessImages business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete image 1' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Delete this image?')).toBeTruthy()
    expect(within(dialog).getByRole('img').getAttribute('alt')).toBe('Image 1 of 2')
    await user.click(within(dialog).getByRole('button', { name: 'Delete image' }))
    expect(probe.remove).toHaveBeenCalledWith(1)
  })

  it('a failed delete says why (G2-16) and the notice does not come back by itself (G2-15)', async () => {
    const user = userEvent.setup()
    probe.remove = vi.fn().mockResolvedValue({ ok: false, error: 'Not allowed' })
    const { rerender } = render(<BusinessImages business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete image 1' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete image' }))
    expect(screen.getByText('Not allowed')).toBeTruthy()
    // a new action clears it; an unrelated re-render does not bring anything back
    await user.click(screen.getByRole('button', { name: 'Delete image 2' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Not allowed')).toBeNull()
    rerender(<BusinessImages business={{ ...STORE }} />)
    expect(screen.queryByText('Not allowed')).toBeNull()
  })

  it('says when the store has no images yet', () => {
    render(<BusinessImages business={{ id: 2, name: 'Fast Bite', gallery: [] }} />)
    expect(screen.getByText('No images yet')).toBeTruthy()
  })
})
