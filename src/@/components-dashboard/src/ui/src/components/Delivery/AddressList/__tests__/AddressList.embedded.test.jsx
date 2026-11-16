/* eslint-disable import/first */
import React from 'react'
import { createRequire } from 'node:module'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E3: the embedded mode (`isEmbedded`) of the address list, used inside the create-order wizard.
const mockController = { current: {} }
const mocks = vi.hoisted(() => ({ form: { current: null } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  AddressList: ({ UIComponent, ...props }) => <UIComponent {...props} {...mockController.current} />
}))
vi.mock('../../../../utils', () => ({ scrollTo: vi.fn() }))
vi.mock('../../AddressForm', () => ({
  AddressForm: props => {
    mocks.form.current = props
    return (
      <div data-testid='address-form'>
        <h4 tabIndex={-1} data-address-form-title=''>{Object.keys(props.address ?? {}).length ? 'Edit address' : 'Add address'}</h4>
        <button type='button' onClick={props.onCancel}>Cancel</button>
      </div>
    )
  }
}))

import { AddressList } from '..'

// redesign UF-R1 (F5): axe-core is not a direct dependency: it comes with @axe-core/playwright (as in SelectAria.f6h.test.jsx).
// jsdom has no layout or colour, so only the structural rules run.
const requireFrom = createRequire(import.meta.url)
const axe = createRequire(requireFrom.resolve('@axe-core/playwright'))('axe-core')
const STRUCTURE_RULES = ['list', 'listitem', 'aria-required-children', 'aria-required-parent', 'aria-allowed-role', 'aria-allowed-attr', 'nested-interactive', 'label']
const audit = async root => {
  let result
  await act(async () => {
    result = await axe.run(root, { runOnly: { type: 'rule', values: STRUCTURE_RULES }, resultTypes: ['violations'] })
  })
  return result.violations.map(violation => `${violation.id} (${violation.impact}) x${violation.nodes.length} ${violation.nodes[0].any.map(check => check.message).join('|')}`)
}

const home = { id: 1, address: 'Home street 1', default: true, tag: 'home', zipcode: '10001' }
const office = { id: 2, address: 'Office street 2', default: false, tag: 'office' }
const theme = { ...defaultTheme, images: { general: {} } }

const renderList = (controller = {}, props = {}) => {
  mockController.current = {
    addressList: { loading: false, error: null, addresses: [home, office] },
    actionStatus: { loading: false, error: null },
    setAddressList: vi.fn(),
    handleSetDefault: vi.fn(),
    handleDelete: vi.fn(),
    ...controller
  }
  return renderWithProviders(<AddressList isEmbedded isSeletectedUserAddresses userId={7} {...props} />, { theme })
}

let outerKeys
const spy = event => outerKeys(event.key)
beforeEach(() => {
  outerKeys = vi.fn()
  document.addEventListener('keydown', spy)
})
afterEach(() => {
  document.removeEventListener('keydown', spy)
  document.getElementById('app-modals')?.remove()
})

describe('AddressList · embedded', () => {
  // redesign UF-R1 (F5): the old `<ul role=radiogroup>` held the Edit and Delete buttons too, which axe flags (serious x6). A named
  // list whose radios share a `name` is valid and keeps the native group (arrow keys, one selected).
  it('lists the addresses as a named list of native radios of one group, with the default one chosen', () => {
    renderList()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Select customer address' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    const radios = within(list).getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(new Set(radios.map(radio => radio.getAttribute('name')))).toEqual(new Set(['customer-address']))
    expect(within(list).getByRole('radio', { name: /Home street 1/ })).toBeChecked()
    expect(within(list).getByRole('radio', { name: /Office street 2/ })).not.toBeChecked()
  })

  it('passes the structural axe rules with its Edit and Delete buttons inside the rows', async () => {
    const { container } = renderList()
    expect(await audit(container)).toEqual([])
  })

  it('moves between the native radios with the arrow keys', async () => {
    const user = userEvent.setup()
    renderList()
    screen.getByRole('radio', { name: /Home street 1/ }).focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: /Office street 2/ })).toHaveFocus()
  })

  it('names the type of each address in words, not only with an icon', () => {
    renderList()
    expect(screen.getByText(/^Home/, { selector: '.odc-steps-row-meta' })).toHaveTextContent('Home · 10001')
    expect(screen.getByText(/^Office/, { selector: '.odc-steps-row-meta' })).toBeInTheDocument()
  })

  it('chooses an address by pressing anywhere on its row', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByText('Office street 2'))
    expect(mockController.current.handleSetDefault).toHaveBeenCalledWith(office, undefined)
  })

  it('does nothing when the address pressed is the default one', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByText('Home street 1'))
    expect(mockController.current.handleSetDefault).not.toHaveBeenCalled()
  })

  it('edit and delete are separate named buttons; delete asks first and the default one cannot be deleted', async () => {
    const user = userEvent.setup()
    renderList()
    expect(screen.getByRole('button', { name: 'Delete Home street 1' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Delete Office street 2' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Are you sure that you want to delete the address?')).toBeInTheDocument()
    expect(mockController.current.handleDelete).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mockController.current.handleDelete).toHaveBeenCalledWith(office)
  })

  it('"Add new address" opens the embedded form in place of the list', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByRole('button', { name: 'Add new address' }))
    expect(screen.getByTestId('address-form')).toBeInTheDocument()
    expect(mocks.form.current.isEmbedded).toBe(true)
    expect(screen.queryByRole('list', { name: 'Select customer address' })).not.toBeInTheDocument()
  })

  it('Edit opens the form with that address', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByRole('button', { name: 'Edit Office street 2' }))
    expect(mocks.form.current.address).toEqual(office)
  })

  it('Escape in the form goes back to the list, gives the focus back, and stops there', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByRole('button', { name: 'Edit Office street 2' }))
    await user.click(within(screen.getByTestId('address-form')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Office street 2' })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Add new address' }))
    screen.getByRole('heading', { name: 'Add address' }).focus()
    outerKeys.mockClear()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('address-form')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Select customer address' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add new address' })).toHaveFocus())
    expect(outerKeys).not.toHaveBeenCalledWith('Escape')
  })

  it('an Escape with the list showing is not taken: it is the view behind who decides', async () => {
    const user = userEvent.setup()
    renderList()
    screen.getByRole('button', { name: 'Add new address' }).focus()
    outerKeys.mockClear()
    await user.keyboard('{Escape}')
    expect(outerKeys).toHaveBeenCalledWith('Escape')
  })

  it('says why there is nothing to show: loading, error and no addresses', () => {
    const { unmount } = renderList({ addressList: { loading: true, error: null, addresses: [] } })
    expect(screen.getByRole('group', { busy: true })).toBeInTheDocument()
    unmount()
    const second = renderList({ addressList: { loading: false, error: [{ message: 'Could not load addresses' }], addresses: [] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load addresses')
    second.unmount()
    renderList({ addressList: { loading: false, error: null, addresses: [] } })
    expect(screen.getByText('Sorry, You don\'t seem to have any addresses.')).toBeInTheDocument()
  })

  // the classic list's test of this went with the classic branch; the embedded button keeps the behaviour
  it('disables adding an address while an address action is running', () => {
    renderList({ actionStatus: { loading: true, error: null } })
    expect(screen.getByRole('button', { name: 'Add new address' })).toBeDisabled()
  })

  it('shows the error of an action (set default, delete) in the list instead of dropping it', () => {
    renderList({ actionStatus: { loading: false, error: ['The address could not be saved'] } })
    expect(screen.getByRole('alert')).toHaveTextContent('The address could not be saved')
  })

  it('draws none of the legacy markup', () => {
    const { container } = renderList()
    expect(container.querySelector('#list')).toBeNull()
    expect(container.querySelector('.wrapAddress')).toBeNull()
    // The sub view hides #address_control while a form is open; the embedded list must stay focusable then.
    expect(container.querySelector('#address_control')).toBeNull()
  })
})
