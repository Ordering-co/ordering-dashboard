/* eslint-disable import/first */
// Batch 5.4-B · the tracking domain as a Product Dialog (C8): role and name, help text, where the focus
// starts, Escape, the footer in order and the error tied to the field. The saved value and the
// `localStorage` contract stay in OrderTrackingLink.test.jsx. The Product wrappers are real here.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }, { configurations: {} }],
  useSite: () => [{ sites: [] }]
}))

vi.mock('../../../../contexts/ProjectContext', () => ({
  useProjectState: () => [{}]
}))

vi.mock('react-bootstrap', () => ({
  Dropdown: {
    Item: ({ children, ...props }) => <button {...props}>{children}</button>
  }
}))

// The legacy shell and controls stay stubs; the dialog under test is the Product one.
vi.mock('../../../../styles', () => ({
  Button: ({ children, color, ...props }) => <button {...props}>{children}</button>,
  Input: (props) => <input {...props} />
}))
vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null
}))

import { OrderTrackingLink } from '..'

const order = { uuid: 'order-uuid', hash_key: 'secret-hash' }
const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

const openDialog = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Edit tracking URL' }))
  return screen.findByRole('dialog', { name: 'Edit tracking URL' })
}

// redesign F6c (Q2-14): the domain source is the C18 dropdown (FirstSelect), no longer a native select
const sourceField = dialog => within(dialog).getByRole('button', { name: /Tracking domain source/ })
const chooseSource = async (user, dialog, name) => {
  await user.click(sourceField(dialog))
  await user.click(within(screen.getByRole('listbox')).getByRole('option', { name }))
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(window, 'open').mockImplementation(() => null)
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('OrderTrackingLink · dialog', () => {
  it('opens a dialog named like the menu item that opened it, with the help, Cancel first and Save last', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    const dialog = await openDialog(user)
    expect(within(dialog).getByText('Enter the tracking domain used for customer order links.')).toBeInTheDocument()
    expect(footerButtons(dialog)).toEqual(['Cancel', 'Save'])
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('starts the focus on the domain selector', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    const dialog = await openDialog(user)
    await waitFor(() => expect(sourceField(dialog)).toHaveFocus())
  })

  it('draws the domain source as the C18 dropdown: no native select, the value in the field, one row per choice', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    const dialog = await openDialog(user)
    expect(dialog.querySelector('select')).toBeNull()
    expect(sourceField(dialog)).toHaveAttribute('aria-haspopup', 'listbox')
    expect(sourceField(dialog)).toHaveTextContent('Default')
    await user.click(sourceField(dialog))
    const rows = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(rows.map(row => row.querySelector('.odc-so-label').textContent)).toEqual(['Default', 'Other'])
    expect(rows[0]).toHaveAttribute('aria-selected', 'true')
    expect(rows[1].querySelector('.odc-so-meta')).toHaveTextContent('Enter a tracking domain manually')
  })

  it('Escape in the open list closes the list only, then the dialog on the next one', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    const dialog = await openDialog(user)
    await user.click(sourceField(dialog))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Edit tracking URL' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Escape and Cancel close it without saving anything', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    await openDialog(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.localStorage.getItem('tracking_domain:demo')).toBeNull()
  })

  it('the manual domain has a visible label and Enter in it saves, like the Save button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    const dialog = await openDialog(user)
    await chooseSource(user, dialog, /^Other/)
    const field = within(dialog).getByRole('textbox', { name: 'Tracking domain' })
    expect(dialog.querySelector(`label[for="${field.id}"]`)).not.toBeNull()
    await user.type(field, 'tracking.example.com{Enter}')
    expect(window.localStorage.getItem('tracking_domain:demo')).toBe('https://tracking.example.com')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('an invalid domain stays in the dialog with the error tied to the field', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    const dialog = await openDialog(user)
    await chooseSource(user, dialog, /^Other/)
    const field = within(dialog).getByRole('textbox', { name: 'Tracking domain' })
    await user.type(field, 'not a domain')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Please enter a valid domain')
    expect(field).toHaveAccessibleDescription('Please enter a valid domain')
    expect(screen.getByRole('dialog', { name: 'Edit tracking URL' })).toBeInTheDocument()
    expect(window.localStorage.getItem('tracking_domain:demo')).toBeNull()
  })
})

// redesign F6d-2 (Q3-11): the list of the domain source is an overlay, not part of the dialog body: the dialog keeps
// its size when it opens, so the stylesheet no longer reserves height for it.
describe('OrderTrackingLink · the domain list is an overlay', () => {
  it('draws the list outside the dialog box', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderTrackingLink order={order} />)
    const dialog = await openDialog(user)
    await user.click(sourceField(dialog))
    const list = await screen.findByRole('listbox')
    expect(dialog.contains(list)).toBe(false)
    expect(document.getElementById('app-modals').contains(list)).toBe(true)
  })

  it('does not reserve height in the dialog body while the list is open', () => {
    const css = readFileSync(resolve(__dirname, '../tracking-link.css'), 'utf8')
    expect(css).not.toMatch(/:has\(/)
    expect(css).not.toMatch(/aria-expanded/)
  })
})
