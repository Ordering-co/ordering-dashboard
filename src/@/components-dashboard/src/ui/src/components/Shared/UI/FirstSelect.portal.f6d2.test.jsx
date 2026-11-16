/* eslint-disable import/first */
// redesign F6d-2 (Q3-11): `portal` draws the C18 list as an overlay in the shared layer host (#app-modals) instead
// of inside the field's own box, so a surface with a clipping or auto-height body (a dialog) keeps its size.
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { FirstSelect } from './FirstSelect'
import { Dialog } from '../Product/Dialog'

afterEach(() => document.getElementById('app-modals')?.remove())

const text = value => <span>{value}</span>
const items = [
  { value: 1, content: text('Ana') },
  { value: 2, content: text('Beto') },
  { value: 3, content: text('Berta') }
]

const renderSelect = (props = {}, wrapper = node => node) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    {wrapper(<FirstSelect placeholder='Pick one' options={items} defaultValue={1} fitTrigger portal onChange={vi.fn()} {...props} />)}
  </ThemeProvider>
)

const trigger = () => document.querySelector('.od-first-select-trigger')
const root = () => document.querySelector('.od-first-select-root:not([data-portal])')

describe('FirstSelect portal (Q3-11)', () => {
  it('draws the list in the shared layer host, outside the field', async () => {
    const user = userEvent.setup()
    renderSelect()
    await user.click(trigger())
    const list = await screen.findByRole('listbox')
    expect(root().contains(list)).toBe(false)
    expect(document.getElementById('app-modals').contains(list)).toBe(true)
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
  })

  it('without the prop the list stays inside the field, as before', async () => {
    const user = userEvent.setup()
    renderSelect({ portal: false })
    await user.click(trigger())
    expect(root().contains(screen.getByRole('listbox'))).toBe(true)
    expect(document.getElementById('app-modals')).toBeNull()
  })

  it('picks a row, closes the list, releases the host and gives the focus back to the field', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderSelect({ onChange })
    await user.click(trigger())
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'Berta' }))
    expect(onChange).toHaveBeenCalledWith(3)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.getElementById('app-modals')).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  it('opens on the selected row with ArrowDown and types ahead', async () => {
    const user = userEvent.setup()
    renderSelect({ defaultValue: 2 })
    trigger().focus()
    await user.keyboard('{ArrowDown}')
    await waitFor(() => expect(document.activeElement).toHaveTextContent('Beto'))
    await user.keyboard('b')
    expect(document.activeElement).toHaveTextContent('Berta')
  })

  it('puts the focus in the search field of a portaled list', async () => {
    const user = userEvent.setup()
    renderSelect({ isShowSearchBar: true, searchValue: '', handleChangeSearch: vi.fn() })
    await user.click(trigger())
    expect(await screen.findByRole('searchbox')).toHaveFocus()
  })

  it('Esc closes only the list; a click outside closes it too', async () => {
    const user = userEvent.setup()
    renderSelect()
    await user.click(trigger())
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger()).toHaveFocus()
    await user.click(trigger())
    await screen.findByRole('listbox')
    await user.click(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('inside a dialog the list is not part of the dialog box, so the dialog keeps its size; the dialog stays open', async () => {
    const user = userEvent.setup()
    renderSelect({}, node => (
      <Dialog open onOpenChange={vi.fn()} title='Edit' closeLabel='Close'>{node}</Dialog>
    ))
    const dialog = await screen.findByRole('dialog', { name: 'Edit' })
    await user.click(within(dialog).getByRole('button', { name: /Ana/ }))
    const list = await screen.findByRole('listbox')
    expect(dialog.contains(list)).toBe(false)
    await user.click(within(list).getByRole('option', { name: 'Beto' }))
    expect(screen.getByRole('dialog', { name: 'Edit' })).toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })
})
