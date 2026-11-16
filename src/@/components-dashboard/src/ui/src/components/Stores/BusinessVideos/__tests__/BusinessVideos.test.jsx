/* eslint-disable import/first */
// redesign stores 5.3: Store details › Videos. Covered: the URL field has a label and only takes an http(s) link;
// «Add» is off while empty and busy while saving (G2-18); a failed add says why under the field; delete asks first and a failed
// delete says why (G2-16); a notice never re-opens on its own (G2-15).
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ add: null, remove: null, adding: false }))

const gallery = vi.hoisted(() => ({
  BusinessGallery: ({ UIComponent, ...props }) => {
    const videos = (props.business?.gallery || []).filter(item => item.video)
    return (
      <UIComponent
        {...props}
        businessPhotos={[]}
        businessVideos={videos}
        adding={probe.adding}
        deletingId={null}
        handleAddGalleryItem={(...args) => probe.add(...args)}
        handleDeleteBusinessGallery={(...args) => probe.remove(...args)}
      />
    )
  }
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessGallery: gallery.BusinessGallery
}))
vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessGallery: gallery.BusinessGallery
}))

import { BusinessVideos } from '../index'

const STORE = {
  id: 2,
  gallery: [
    { id: 1, file: 'https://img.test/1.png' },
    { id: 7, video: 'https://youtu.be/abc' },
    { id: 8, video: 'https://vimeo.com/123' }
  ]
}

beforeEach(() => {
  probe.add = vi.fn().mockResolvedValue({ ok: true, result: {} })
  probe.remove = vi.fn().mockResolvedValue({ ok: true })
  probe.adding = false
})

describe('Store details › Videos', () => {
  it('lists the videos as links, each with a named delete', () => {
    render(<BusinessVideos business={STORE} />)
    const list = screen.getByRole('list', { name: 'Videos' })
    const links = within(list).getAllByRole('link')
    expect(links.map(a => a.getAttribute('href'))).toEqual(['https://youtu.be/abc', 'https://vimeo.com/123'])
    expect(links[0].getAttribute('rel')).toContain('noopener')
    expect(screen.getByRole('button', { name: 'Delete video 2' })).toBeTruthy()
  })

  it('shows a saved address that is not http(s) as text, never as a link (review 2)', () => {
    render(<BusinessVideos business={{ id: 2, gallery: [{ id: 9, video: 'javascript:alert(1)' }, { id: 7, video: 'https://youtu.be/abc' }] }} />)
    const list = screen.getByRole('list', { name: 'Videos' })
    expect(within(list).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['https://youtu.be/abc'])
    expect(within(list).getByText('javascript:alert(1)').closest('a')).toBeNull()
  })

  it('labels the URL field and keeps «Add» off while it is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessVideos business={STORE} />)
    const field = screen.getByLabelText('Video url')
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add.disabled).toBe(true)
    await user.type(field, 'https://youtu.be/new')
    expect(add.disabled).toBe(false)
  })

  it('refuses a value that is not an http(s) link, under the field (G2-18)', async () => {
    const user = userEvent.setup()
    render(<BusinessVideos business={STORE} />)
    await user.type(screen.getByLabelText('Video url'), 'my video')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(probe.add).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a link that starts with http:// or https://')).toBeTruthy()
    expect(screen.getByLabelText('Video url').getAttribute('aria-invalid')).toBe('true')
  })

  it('adds a valid link with the same request and clears the field', async () => {
    const user = userEvent.setup()
    render(<BusinessVideos business={STORE} />)
    await user.type(screen.getByLabelText('Video url'), '  https://youtu.be/new  ')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(probe.add).toHaveBeenCalledWith({ video: 'https://youtu.be/new' })
    expect(screen.getByLabelText('Video url').value).toBe('')
  })

  it('says why an add failed and keeps what was typed', async () => {
    const user = userEvent.setup()
    probe.add = vi.fn().mockResolvedValue({ ok: false, error: 'Invalid video' })
    render(<BusinessVideos business={STORE} />)
    await user.type(screen.getByLabelText('Video url'), 'https://youtu.be/new')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Invalid video')).toBeTruthy()
    expect(screen.getByLabelText('Video url').value).toBe('https://youtu.be/new')
  })

  it('shows «Add» busy and the field off while saving', () => {
    probe.adding = true
    render(<BusinessVideos business={STORE} />)
    expect(screen.getByRole('button', { name: 'Add' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByLabelText('Video url').disabled).toBe(true)
  })

  it('deletes after a confirmation that names the link; a failed delete says why once (G2-15, G2-16)', async () => {
    const user = userEvent.setup()
    probe.remove = vi.fn().mockResolvedValue({ ok: false, error: 'Not allowed' })
    const { rerender } = render(<BusinessVideos business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete video 1' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('https://youtu.be/abc')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Delete video' }))
    expect(probe.remove).toHaveBeenCalledWith(7)
    expect(screen.getByText('Not allowed')).toBeTruthy()
    await user.type(screen.getByLabelText('Video url'), 'h')
    rerender(<BusinessVideos business={{ ...STORE }} />)
    // still the one notice of that delete, never a second dialog
    expect(screen.getAllByText('Not allowed')).toHaveLength(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('says when the store has no videos yet', () => {
    render(<BusinessVideos business={{ id: 2, gallery: [] }} />)
    expect(screen.getByText('No videos yet')).toBeTruthy()
  })
})
