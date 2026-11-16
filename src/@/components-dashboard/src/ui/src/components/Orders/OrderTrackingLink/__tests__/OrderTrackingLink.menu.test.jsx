/* eslint-disable import/first */
// redesign fix-qa E5: the two tracking actions as direct items (as in `main`) for the «More actions» menu of
// the order panel, with the reason when they are off, and the domain dialog with a labelled C18 dropdown (redesign F6c).
// OrderTrackingLink.test.jsx keeps the legacy dropdown items and the saved value contract.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ configurations: {}, sites: [] }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }, { configurations: runtime.configurations }],
  useSite: () => [{ sites: runtime.sites }]
}))
vi.mock('../../../../contexts/ProjectContext', () => ({
  useProjectState: () => [{}]
}))
vi.mock('react-bootstrap', () => ({
  Dropdown: { Item: ({ children, ...props }) => <button {...props}>{children}</button> }
}))

import { useOrderTrackingLink } from '..'

const Harness = ({ order }) => {
  const { menuItems, dialog } = useOrderTrackingLink(order)
  return (
    <>
      {menuItems.map(item => (
        <React.Fragment key={item.key}>
          <button
            type='button'
            disabled={item.disabled}
            aria-describedby={item.description ? `${item.key}-why` : undefined}
            onClick={item.onSelect}
          >
            {item.label}
          </button>
          {item.description && <span id={`${item.key}-why`} hidden>{item.description}</span>}
        </React.Fragment>
      ))}
      {dialog}
    </>
  )
}

const order = { uuid: 'order-uuid', hash_key: 'secret-hash' }

beforeEach(() => {
  window.localStorage.clear()
  runtime.configurations = {}
  runtime.sites = []
  vi.spyOn(window, 'open').mockImplementation(() => null)
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('useOrderTrackingLink · menu items', () => {
  it('gives Open tracking URL and Edit tracking URL… in that order', () => {
    renderWithProviders(<Harness order={order} />)
    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Open tracking URL', 'Edit tracking URL…'])
  })

  it('both are off with their reason while the order has no tracking link', () => {
    renderWithProviders(<Harness order={{}} />)
    for (const name of ['Open tracking URL', 'Edit tracking URL…']) {
      const item = screen.getByRole('button', { name })
      expect(item).toBeDisabled()
      expect(item).toHaveAccessibleDescription('This order has no tracking link yet')
    }
  })

  it('with a link but no domain, Open says what is missing and Edit is the way out', async () => {
    renderWithProviders(<Harness order={order} />)
    const open = screen.getByRole('button', { name: 'Open tracking URL' })
    expect(open).toBeDisabled()
    expect(open).toHaveAccessibleDescription('Choose a tracking domain first')
    expect(screen.getByRole('button', { name: 'Edit tracking URL…' })).toBeEnabled()
  })

  it('Open goes to the saved domain in a new tab without opener access', async () => {
    window.localStorage.setItem('tracking_domain:demo', 'https://tracking.example.com')
    const user = userEvent.setup()
    renderWithProviders(<Harness order={order} />)
    await user.click(screen.getByRole('button', { name: 'Open tracking URL' }))
    expect(window.open).toHaveBeenCalledWith('https://tracking.example.com/orders/order-uuid?hash=secret-hash', '_blank', 'noopener,noreferrer')
  })

  it('Edit opens the domain dialog, named like the item, with a labelled selector; Cancel closes it and saves nothing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness order={order} />)
    await user.click(screen.getByRole('button', { name: 'Edit tracking URL…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit tracking URL' })
    const field = within(dialog).getByRole('button', { name: /Tracking domain source/ })
    expect(dialog.querySelector('select')).toBeNull()
    expect(field).toHaveTextContent('Default')
    await user.click(field)
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(option => option.textContent)).toEqual(['Default', 'OtherEnter a tracking domain manually'])
    await user.keyboard('{Escape}')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.localStorage.getItem('tracking_domain:demo')).toBeNull()
    expect(window.open).not.toHaveBeenCalled()
  })
})
