/* eslint-disable import/first */
// redesign stores 1.A (G5-01): the custom slug of Ordering channels is saved through the shared form. A slug the
// API rejected (one already in use) was sent again on every render while the failure lasted. Each Save is one request.
// redesign stores 5.15a: Custom slug is `S/StoreSlugField` with its own Save (the slug alone, keepPendingChanges, the
// error under the field, «Saved» after it); the tabs are P/Tabs with the same `?tab=`.
import React, { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', async (importOriginal) => ({
  ...(await importOriginal()),
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{ configs: {} }]
}))
vi.mock('~components', async (importOriginal) => ({
  ...(await importOriginal()),
  useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text]
}))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({ useStoreWebsiteUrl: (slug) => slug ? `https://shop.example.com/store/${slug}` : null }))
vi.mock('../../BusinessWidgets', () => ({ BusinessWidgets: () => <p>Widgets body</p> }))

import { BusinessOrderingChannels } from '../index'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

const Harness = ({ ok, onSave }) => {
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const handleUpdateBusinessClick = async (changes, options) => {
    onSave(changes, options)
    await Promise.resolve()
    return ok ? { ok: true } : { ok: false, error: ['The slug is already in use'] }
  }
  return (
    <BusinessOrderingChannels
      business={{ id: 7, slug: 'sample' }}
      formState={formState}
      setFormState={setFormState}
      handleUpdateBusinessClick={handleUpdateBusinessClick}
    />
  )
}

const setup = (ok = true, url = '/stores/list?id=7&section=ordering_channels') => {
  window.history.replaceState(null, '', url)
  const onSave = vi.fn()
  render(<MemoryRouter initialEntries={[url]}><Harness ok={ok} onSave={onSave} /></MemoryRouter>)
  return onSave
}

const field = () => screen.getByRole('textbox', { name: 'Slug' })
const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() }) }
const saveSlug = async (slug) => {
  fireEvent.change(field(), { target: { value: slug } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
  await flush()
}

describe('BusinessOrderingChannels · custom slug, one request per Save', () => {
  it('a slug the API accepts is sent once, alone, and «Saved» follows', async () => {
    const onSave = setup(true)
    await saveSlug('newslug')
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ slug: 'newslug' }, { keepPendingChanges: true })
  })

  it('a slug the API rejects is sent once, says why under the field, and again only when Save is pressed again', async () => {
    const onSave = setup(false)
    await saveSlug('taken')
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByText('The slug is already in use')).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    await flush()
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('is the one slug editor: letters and numbers only, empty is said and cannot be saved', async () => {
    const onSave = setup(true)
    fireEvent.change(field(), { target: { value: 'new-slug 2' } })
    expect(field()).toHaveValue('newslug2')
    fireEvent.change(field(), { target: { value: '' } })
    expect(screen.getByText('Slug is required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('says the public address under the stored slug', () => {
    setup(true)
    expect(screen.getByText('shop.example.com/store/sample')).toBeInTheDocument()
  })
})

describe('BusinessOrderingChannels · tabs', () => {
  it('Custom slug | Widgets as a named tablist; a change writes ?tab=', async () => {
    setup(true)
    const tablist = screen.getByRole('tablist', { name: 'Extensions' })
    expect(tablist).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Custom slug' })).toHaveAttribute('aria-selected', 'true')
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Widgets' })) })
    expect(screen.getByText('Widgets body')).toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('widgets')
  })

  it('opens the tab of the URL', () => {
    setup(true, '/stores/list?id=7&section=ordering_channels&tab=widgets')
    expect(screen.getByRole('tab', { name: 'Widgets' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Widgets body')).toBeInTheDocument()
  })

  it('without a valid ?tab= opens the default tab and writes it, as main did', () => {
    setup(true, '/stores/list?id=7&section=ordering_channels&tab=bogus')
    expect(screen.getByRole('tab', { name: 'Custom slug' })).toHaveAttribute('aria-selected', 'true')
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('custom_slug')
  })

  // main every owner has both tabs
  it('?tab=custom_slug opens Custom slug for every owner', () => {
    setup(true, '/stores/list?id=7&section=ordering_channels&tab=custom_slug')
    expect(screen.getByRole('tab', { name: 'Custom slug' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Widgets' })).toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('custom_slug')
  })
})
