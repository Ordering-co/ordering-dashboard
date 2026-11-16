/* eslint-disable import/first */
// redesign stores 5.15b (; decision 4, G5-15, G5-16): the layout of the store's website.
// - the two layouts are a radiogroup of cards, usable with the keyboard (main: `div onClick` tiles);
// - the choice is a draft saved by the SaveBar, which sends ONLY `front_layout` with keepPendingChanges (main replaced every
//   pending change of the form with it);
// - leaving with the draft asks (2.A); a failed save says why and keeps the draft.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ configs: { use_parent_category: { value: '1' } } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useConfig: () => [{ configs: state.configs }]
}))

import { LeaveGuardContext } from '../../../Shared/Product'
import { BusinessFrontLayout } from '../index'

afterEach(() => {
  cleanup()
  state.configs = { use_parent_category: { value: '1' } }
})

const renderSection = ({ business = { id: 2, front_layout: 'food' }, update, host } = {}) => {
  const handleUpdateBusinessClick = update || vi.fn().mockResolvedValue({ ok: true })
  render(
    <LeaveGuardContext.Provider value={host || null}>
      <BusinessFrontLayout business={business} handleUpdateBusinessClick={handleUpdateBusinessClick} />
    </LeaveGuardContext.Provider>
  )
  return { handleUpdateBusinessClick }
}
const radio = (name) => screen.getByRole('radio', { name })
const bar = () => screen.queryByRole('group', { name: 'Save changes' })

describe('BusinessFrontLayout · cards (G5-15)', () => {
  it('is one named radiogroup of two cards, with the stored layout checked', () => {
    renderSection()
    const group = screen.getByRole('radiogroup', { name: 'Layout of the store\'s website' })
    expect(group).toHaveAttribute('data-variant', 'cards')
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    expect(radio('Food')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Groceries')).toHaveAttribute('aria-checked', 'false')
    expect(radio('Food')).toHaveAccessibleDescription(/For restaurants/)
  })

  it('is chosen with the keyboard', async () => {
    const user = userEvent.setup()
    renderSection()
    radio('Food').focus()
    await user.keyboard('{ArrowDown}')
    expect(radio('Groceries')).toHaveAttribute('aria-checked', 'true')
    expect(bar()).not.toBeNull()
  })

  it('offers only Food without parent categories, as main', () => {
    state.configs = {}
    renderSection()
    expect(screen.getAllByRole('radio')).toHaveLength(1)
  })

  // review 5.15b R1: a disabled checked radio is the group's only Tab stop and cannot take the focus, so the group was out of reach
  it('shows a store already on Groceries with parent categories off as chosen, with the reason, and reachable with Tab', async () => {
    const user = userEvent.setup()
    state.configs = {}
    const { handleUpdateBusinessClick } = renderSection({ business: { id: 2, front_layout: 'groceries' } })
    expect(radio('Groceries')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Groceries')).toHaveAccessibleDescription(/Needs parent categories/)
    await user.tab()
    expect(radio('Groceries')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(radio('Food')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowDown}')
    expect(bar()).toBeNull()
    expect(handleUpdateBusinessClick).not.toHaveBeenCalled()
  })
})

describe('BusinessFrontLayout · save (G5-16, decision 4)', () => {
  it('writes nothing on choosing; the bar appears with the change and Save sends only front_layout', async () => {
    const { handleUpdateBusinessClick } = renderSection()
    expect(bar()).toBeNull()
    fireEvent.click(radio('Groceries'))
    expect(handleUpdateBusinessClick).not.toHaveBeenCalled()
    expect(within(bar()).getByText(/1 unsaved change/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(handleUpdateBusinessClick).toHaveBeenCalledTimes(1)
    expect(handleUpdateBusinessClick).toHaveBeenCalledWith({ front_layout: 'groceries' }, { keepPendingChanges: true })
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('choosing the stored layout again leaves nothing to save', () => {
    renderSection()
    fireEvent.click(radio('Groceries'))
    fireEvent.click(radio('Food'))
    expect(bar()).toBeNull()
  })

  it('Discard goes back to the stored layout', () => {
    renderSection()
    fireEvent.click(radio('Groceries'))
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(radio('Food')).toHaveAttribute('aria-checked', 'true')
    expect(bar()).toBeNull()
  })

  it('a failed save says why and keeps the choice', async () => {
    const update = vi.fn().mockResolvedValue({ ok: false, error: ['The layout could not be saved'] })
    renderSection({ update })
    fireEvent.click(radio('Groceries'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(screen.getByRole('alert')).toHaveTextContent('The layout could not be saved')
    expect(radio('Groceries')).toHaveAttribute('aria-checked', 'true')
  })

  it('registers in the leave guard: dirty with a draft, and its save works', async () => {
    let entry
    const host = { register: vi.fn(ref => { entry = ref; return () => {} }), requestLeave: vi.fn() }
    const { handleUpdateBusinessClick } = renderSection({ host })
    expect(host.register).toHaveBeenCalledTimes(1)
    expect(entry.current.isDirty()).toBe(false)
    fireEvent.click(radio('Groceries'))
    expect(entry.current.isDirty()).toBe(true)
    await act(async () => { await entry.current.save() })
    expect(handleUpdateBusinessClick).toHaveBeenCalledWith({ front_layout: 'groceries' }, { keepPendingChanges: true })
  })
})
