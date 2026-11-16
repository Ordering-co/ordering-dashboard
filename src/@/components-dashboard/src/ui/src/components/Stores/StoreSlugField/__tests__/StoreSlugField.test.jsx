/* eslint-disable import/first */
// redesign stores 5.1b (decision 4, G2-20): the one editor of a store's slug. With `onSave` it saves the slug alone
// (the Overview, whose own tests cover that path); without it the slug goes with the form around it (Store details › SEO).
import React, { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))

import { StoreSlugField } from '../index'

const Harness = ({ savedSlug = 'fastbite', initial = {}, onSave }) => {
  const [formState, setFormState] = useState({ loading: false, changes: initial })
  const ref = useRef(null)
  Harness.formState = formState
  Harness.setFormState = setFormState
  Harness.ref = ref
  return <StoreSlugField ref={ref} savedSlug={savedSlug} formState={formState} setFormState={setFormState} onSave={onSave} hint='shop.test/store/fastbite' />
}

const field = () => screen.getByRole('textbox', { name: 'Slug' })

describe('StoreSlugField · without its own Save (the slug goes with the form around it)', () => {
  it('has no Save and no «Saved»; what is typed is held by the shared form', async () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    await userEvent.type(field(), '2')
    expect(Harness.formState.changes).toEqual({ slug: 'fastbite2' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('only letters and numbers are kept, typed or pasted (the Overview\'s rule)', async () => {
    render(<Harness />)
    await userEvent.type(field(), '-é 7')
    expect(field()).toHaveValue('fastbite7')
    fireEvent.change(field(), { target: { value: 'fast-bite 2' } })
    expect(field()).toHaveValue('fastbite2')
  })

  it('says an empty slug, and the form reads the problem through the ref', () => {
    render(<Harness />)
    expect(Harness.ref.current.problem).toBeNull()
    fireEvent.change(field(), { target: { value: '' } })
    expect(screen.getByText('Slug is required')).toBeInTheDocument()
    expect(Harness.ref.current.problem).toBe('Slug is required')
  })

  it('a stored slug older than the rule is left as it is and explained', () => {
    render(<Harness savedSlug='fast-bite' />)
    fireEvent.change(field(), { target: { value: 'fast-bite2' } })
    expect(field()).toHaveValue('fast-bite2')
    expect(screen.getByText('Use only letters, numbers and underscores (_).')).toBeInTheDocument()
  })

  // redesign bugs C: the add (and its name) makes slugs with «_»; the editor refused them and the store could not be saved
  it('takes «_», typed or stored: a slug the add made is valid and can be changed and saved', async () => {
    render(<Harness savedSlug='fast_bite' />)
    await userEvent.type(field(), '_2')
    expect(field()).toHaveValue('fast_bite_2')
    expect(screen.queryByText(/Use only letters/)).toBeNull()
    expect(Harness.ref.current.problem).toBeNull()
    expect(Harness.formState.changes).toEqual({ slug: 'fast_bite_2' })
    fireEvent.change(field(), { target: { value: 'my_new-store 2' } })
    expect(field()).toHaveValue('my_newstore2')
  })

  it('shows the hint only while the slug is the stored one', async () => {
    render(<Harness />)
    expect(screen.getByText('shop.test/store/fastbite')).toBeInTheDocument()
    await userEvent.type(field(), 'x')
    expect(screen.queryByText('shop.test/store/fastbite')).toBeNull()
  })

  it('a discard of the shared form (the form\'s Discard, the leave dialog) takes the field back to the stored slug', async () => {
    render(<Harness />)
    await userEvent.type(field(), 'x')
    expect(field()).toHaveValue('fastbitex')
    act(() => Harness.setFormState(prev => ({ ...prev, changes: {} })))
    expect(field()).toHaveValue('fastbite')
  })

  it('starts from what the shared form already holds', () => {
    render(<Harness initial={{ slug: 'quickbite' }} />)
    expect(field()).toHaveValue('quickbite')
  })
})

describe('StoreSlugField · with its own Save', () => {
  it('saves the slug alone, then says «Saved»', async () => {
    const onSave = vi.fn(async () => ({ ok: true }))
    render(<Harness onSave={onSave} />)
    await userEvent.type(field(), '2{Enter}')
    expect(onSave).toHaveBeenCalledWith('fastbite2')
  })

  it('says the API\'s answer under the field when the save fails', async () => {
    const onSave = vi.fn(async () => ({ ok: false, error: ['Slug already in use'] }))
    render(<Harness onSave={onSave} />)
    await userEvent.type(field(), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Slug already in use')).toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
  })
})
