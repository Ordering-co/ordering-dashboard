/* eslint-disable import/first */
// redesign stores 5.2 (; G2-06, G2-07, G2-41; decisions 12c, D1–D3): owners and agents of a store. Covered: each person is a
// row with a native «Remove» named with the person; removing asks first and names the person and the store; the last owner cannot be
// removed (the button is off and a line says why) while agents can go down to none; the list changes only after the save answers and
// a failure is said in the subsection; the people picker searches by name, email or id, marks the ones already in the store, puts the
// chosen name on its button (the confirmation), closes on success and keeps the reason on failure; and the keyboard of the listbox.
import React, { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ users: [], loading: false, error: null, levels: null }))

const mockModule = vi.hoisted(() => () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  UsersList: ({ UIComponent, defaultUserTypesSelected, ...props }) => {
    probe.levels = defaultUserTypesSelected
    return <UIComponent {...props} usersList={{ users: probe.users, loading: probe.loading, error: probe.error }} />
  }
}))
vi.mock('../../../../../../index', mockModule)
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('~components', mockModule)

import { BusinessOwners } from '../index'

const ANA = { id: 1, name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com' }
const BEN = { id: 2, name: 'Ben', lastname: 'Cole', email: 'ben@example.com' }
const CARA = { id: 3, name: 'Cara', lastname: 'Díaz', email: 'cara@example.com' }

// The controller's part: the store changes only when the save answers ok.
const Harness = ({ owners = [ANA, BEN], agents, type = 'owners', answer = () => ({ ok: true }), spies = {} }) => {
  const [business, setBusiness] = useState({ id: 2, name: 'Fast Bite', owners, ...(agents ? { agents } : {}) })
  const handleDeleteBusinessOwner = async (ids, options) => {
    spies.remove?.(ids, options)
    const result = await answer('remove')
    if (result.ok) setBusiness(prev => ({ ...prev, [options.type]: (prev[options.type] || []).filter(person => ids.includes(person.id)) }))
    return result
  }
  const handleAddBusinessOwner = async (ids, person, options) => {
    spies.add?.(ids, person, options)
    const result = await answer('add')
    if (result.ok) setBusiness(prev => ({ ...prev, [options.type]: [...(prev[options.type] || []), person] }))
    return result
  }
  return (
    <BusinessOwners
      business={business}
      type={type}
      handleDeleteBusinessOwner={handleDeleteBusinessOwner}
      handleAddBusinessOwner={handleAddBusinessOwner}
    />
  )
}

const rows = () => within(screen.getByRole('list', { name: /owners|agents/i })).getAllByRole('listitem')

beforeEach(() => {
  probe.users = [ANA, BEN, CARA]
  probe.loading = false
  probe.error = null
  probe.levels = null
})

describe('BusinessOwners', () => {
  it('lists each owner with name and email and a «Remove» button named with the person', () => {
    render(<Harness />)
    expect(rows()).toHaveLength(2)
    expect(screen.getByText('Ana Ruiz')).toBeTruthy()
    expect(screen.getByText('ana@example.com')).toBeTruthy()
    const remove = screen.getByRole('button', { name: 'Remove Ana Ruiz' })
    expect(remove.tagName).toBe('BUTTON')
    expect(screen.getByText('2 owners')).toBeTruthy()
  })

  it('asks before removing, naming the person and the store, and removes after the save answers', async () => {
    const user = userEvent.setup()
    const remove = vi.fn()
    render(<Harness spies={{ remove }} />)
    await user.click(screen.getByRole('button', { name: 'Remove Ana Ruiz' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Remove Ana Ruiz as an owner of Fast Bite?')).toBeTruthy()
    expect(remove).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Remove owner' }))
    expect(remove).toHaveBeenCalledWith([BEN.id], { type: 'owners' })
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.queryByText('Ana Ruiz')).toBeNull()
  })

  // review r1-1: the removed row took the dialog's opener with it; the focus goes to the «Remove» that took its place, else «Add»
  it('puts the focus on the next «Remove» after a removal, and on «Add owner» when none can take it', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness owners={[ANA, BEN, CARA]} />)
    await user.click(screen.getByRole('button', { name: 'Remove Ana Ruiz' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove owner' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Ben Cole' })))
    unmount()
    render(<Harness owners={[ANA, BEN]} />)
    await user.click(screen.getByRole('button', { name: 'Remove Ben Cole' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove owner' }))
    // Ana is the last owner now: her «Remove» is off, so the focus goes to «Add owner»
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add owner' })))
  })

  it('keeps the person and says why when the removal fails', async () => {
    const user = userEvent.setup()
    render(<Harness answer={() => ({ ok: false, error: ['The user is protected'] })} />)
    await user.click(screen.getByRole('button', { name: 'Remove Ana Ruiz' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove owner' }))
    expect(await screen.findByText('The user is protected')).toBeTruthy()
    expect(rows()).toHaveLength(2)
  })

  it('does not let the last owner be removed and says why (decision 12c)', () => {
    render(<Harness owners={[ANA]} />)
    const remove = screen.getByRole('button', { name: 'Remove Ana Ruiz' })
    expect(remove.disabled).toBe(true)
    const note = screen.getByText('A store needs at least one owner.')
    expect(remove.getAttribute('aria-describedby')).toBe(note.id)
  })

  it('lets the last agent be removed and shows an empty list for a store with no agents', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness type='agents' agents={[CARA]} />)
    const remove = screen.getByRole('button', { name: 'Remove Cara Díaz' })
    expect(remove.disabled).toBe(false)
    expect(screen.queryByText('A store needs at least one owner.')).toBeNull()
    await user.click(remove)
    expect(within(await screen.findByRole('alertdialog')).getByText('Remove Cara Díaz as an agent of Fast Bite?')).toBeTruthy()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove agent' })).toBeTruthy() // redesign tanda AB (S-5)
    unmount()
    render(<Harness type='agents' />)
    expect(screen.getByText('This store has no agents yet.')).toBeTruthy()
  })

  it('adds a person with the picker: search, choose, and the button with their name confirms', async () => {
    const user = userEvent.setup()
    const add = vi.fn()
    render(<Harness spies={{ add }} />)
    await user.click(screen.getByRole('button', { name: 'Add owner' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add an owner to Fast Bite' })
    expect(probe.levels).toEqual([2])
    const listbox = within(dialog).getByRole('listbox', { name: 'Business owners' })
    // the ones already in the store are marked and cannot be chosen
    const ana = within(listbox).getByRole('option', { name: /Ana Ruiz/ })
    expect(ana.getAttribute('aria-disabled')).toBe('true')
    expect(within(ana).getByText('Already an owner')).toBeTruthy()
    await user.click(ana)
    expect(within(dialog).getByRole('button', { name: 'Add owner' }).disabled).toBe(true)
    // «diaz» finds «Díaz»
    await user.type(within(dialog).getByRole('searchbox'), 'diaz')
    expect(within(listbox).getAllByRole('option')).toHaveLength(1)
    await user.click(within(listbox).getByRole('option', { name: /Cara Díaz/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Add Cara Díaz' }))
    expect(add).toHaveBeenCalledWith([ANA.id, BEN.id, CARA.id], CARA, { type: 'owners' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(rows()).toHaveLength(3)
  })

  it('finds a person by email or id', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add owner' }))
    const dialog = await screen.findByRole('dialog')
    const search = within(dialog).getByRole('searchbox')
    await user.type(search, 'ben@')
    expect(within(dialog).getAllByRole('option').map(option => option.textContent)).toEqual([expect.stringContaining('Ben Cole')])
    await user.clear(search)
    await user.type(search, '3')
    expect(within(dialog).getAllByRole('option').map(option => option.textContent)).toEqual([expect.stringContaining('Cara Díaz')])
  })

  it('keeps the picker open with the reason when the add fails', async () => {
    const user = userEvent.setup()
    render(<Harness answer={() => ({ ok: false, error: ['Not allowed'] })} />)
    await user.click(screen.getByRole('button', { name: 'Add owner' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('option', { name: /Cara Díaz/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Add Cara Díaz' }))
    expect(await within(dialog).findByText('Not allowed')).toBeTruthy()
    // the page behind the dialog is inert: the rows are there, hidden from the accessibility tree
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(2)
  })

  it('asks the agents level for the agents picker', async () => {
    const user = userEvent.setup()
    render(<Harness type='agents' />)
    await user.click(screen.getByRole('button', { name: 'Add agent' }))
    expect(await screen.findByRole('dialog', { name: 'Add an agent to Fast Bite' })).toBeTruthy()
    expect(probe.levels).toEqual([9])
  })

  it('moves through the people with the arrows and chooses with Enter', async () => {
    const user = userEvent.setup()
    render(<Harness owners={[ANA]} />)
    await user.click(screen.getByRole('button', { name: 'Add owner' }))
    const dialog = await screen.findByRole('dialog')
    const search = within(dialog).getByRole('searchbox')
    search.focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement.textContent).toContain('Ana Ruiz')
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement.textContent).toContain('Ben Cole')
    await user.keyboard('{Enter}')
    expect(within(dialog).getByRole('button', { name: 'Add Ben Cole' })).toBeTruthy()
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(search)
  })

  it('says when the people could not be loaded', async () => {
    const user = userEvent.setup()
    probe.error = ['boom']
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add owner' }))
    expect(await screen.findByText('The list of people could not be loaded.')).toBeTruthy()
  })
})
