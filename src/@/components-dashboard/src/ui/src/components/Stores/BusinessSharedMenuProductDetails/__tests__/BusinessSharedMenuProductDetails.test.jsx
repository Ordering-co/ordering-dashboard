/* eslint-disable import/first */
// redesign stores 5.6 (G3-04, decisions 4 and 5): the detail of a product of a shared menu, on P/NumberField, P/AsyncSwitch,
// P/SearchField and P/SaveBar. The controller is replaced by props (its contract: `productState`, `formState { changes, saving, error }`,
// `handleChangeField`, `pendingChangeKeys`, `isDirty`, `saveChanges`, `discardChanges`, `handleToggleProperty`, `handleUpdateExtra`,
// `handleUpdateOption`, `handleUpdateSuboption`; the last five answer `{ ok } | { ok: false, error }`).
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ useLeaveGuard: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessSharedMenuProductDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
// P/AsyncSwitch reads the language straight from its context
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1920 }) }))
// the real hook, spied: the arguments are checked and the real guard registers in the real piece
vi.mock('../../../Shared/Product/LeaveGuard', async (importOriginal) => {
  const actual = await importOriginal()
  mocks.useLeaveGuard = vi.fn(actual.useLeaveGuard)
  return { ...actual, useLeaveGuard: mocks.useLeaveGuard }
})

import { LeaveGuardContext, SectionSplit } from '../../../Shared/Product'
import { BusinessSharedMenuProductDetails } from '../index'

const EXTRAS = [
  {
    id: 1,
    name: 'Size',
    enabled: true,
    options: [
      { id: 10, name: 'Large', enabled: true, suboptions: [{ id: 100, name: 'Extra cheese', enabled: false }] },
      { id: 11, name: 'Small', enabled: false, suboptions: [{ id: 101, name: 'Hidden sub', enabled: true }] }
    ]
  },
  {
    id: 2,
    name: 'Sauce',
    enabled: false,
    options: [{ id: 20, name: 'BBQ', enabled: true, suboptions: [{ id: 200, name: 'Smoky', enabled: true }] }]
  }
]

const PRODUCT = {
  id: 1,
  name: 'Burger',
  enabled: true,
  featured: true,
  upselling: false,
  inventoried: false,
  price: 10,
  quantity: 5,
  extras: []
}

const buildProps = (overrides = {}) => ({
  business: { id: 7 },
  menu: { id: 5, name: 'Brand menu' },
  product: PRODUCT,
  menuList: { menus: [], menusShared: [] },
  setMenuList: vi.fn(),
  onProductChange: vi.fn(),
  productState: { product: PRODUCT },
  formState: { changes: {}, saving: false, error: null },
  pendingChangeKeys: [],
  isDirty: false,
  handleChangeField: vi.fn(),
  saveChanges: vi.fn().mockResolvedValue({ ok: true }),
  discardChanges: vi.fn(),
  handleToggleProperty: vi.fn().mockResolvedValue({ ok: true }),
  handleUpdateExtra: vi.fn().mockResolvedValue({ ok: true }),
  handleUpdateOption: vi.fn().mockResolvedValue({ ok: true }),
  handleUpdateSuboption: vi.fn().mockResolvedValue({ ok: true }),
  ...overrides
})

const mount = (overrides) => {
  const props = buildProps(overrides)
  const view = renderWithProviders(<BusinessSharedMenuProductDetails {...props} />)
  return { props, ...view }
}

const withExtras = () => ({ productState: { product: { ...PRODUCT, extras: EXTRAS } } })
const switchChecked = name => screen.getByRole('switch', { name }).getAttribute('aria-checked')

beforeEach(() => {
  mocks.useLeaveGuard.mockClear()
})
afterEach(() => cleanup())

describe('BusinessSharedMenuProductDetails · price and quantity', () => {
  it('labels both fields and shows the stored values', () => {
    mount()
    expect(screen.getByRole('textbox', { name: 'Price' }).value).toBe('10')
    expect(screen.getByRole('textbox', { name: 'Quantity' }).value).toBe('5')
  })

  it('shows what is typed (the changes) over the stored value', () => {
    mount({ formState: { changes: { price: 12.5, quantity: 8 }, saving: false, error: null }, isDirty: true, pendingChangeKeys: ['price', 'quantity'] })
    expect(screen.getByRole('textbox', { name: 'Price' }).value).toBe('12.5')
    expect(screen.getByRole('textbox', { name: 'Quantity' }).value).toBe('8')
  })

  it('shows a field the user emptied as empty, not the stored value again', () => {
    mount({ formState: { changes: { price: null }, saving: false, error: null }, isDirty: true, pendingChangeKeys: ['price'] })
    expect(screen.getByRole('textbox', { name: 'Price' }).value).toBe('')
    expect(screen.getByRole('textbox', { name: 'Quantity' }).value).toBe('5')
  })

  it('hands what is typed to the controller as a number, per field', () => {
    const { props } = mount()
    const price = screen.getByRole('textbox', { name: 'Price' })
    fireEvent.change(price, { target: { value: '12' } })
    expect(props.handleChangeField).toHaveBeenLastCalledWith('price', 12)
    const quantity = screen.getByRole('textbox', { name: 'Quantity' })
    fireEvent.change(quantity, { target: { value: '3' } })
    expect(props.handleChangeField).toHaveBeenLastCalledWith('quantity', 3)
  })

  it('does not draw the name of the product (the piece titles it) nor a heading of its own', () => {
    mount()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})

describe('BusinessSharedMenuProductDetails · the property switches', () => {
  it('names each one, shows the stored value and saves through the controller', async () => {
    const user = userEvent.setup()
    const { props } = mount()
    expect(switchChecked('Limit product quantity')).toBe('false')
    expect(switchChecked('Featured')).toBe('true')
    expect(switchChecked('Upselling')).toBe('false')

    await user.click(screen.getByRole('switch', { name: 'Limit product quantity' }))
    expect(props.handleToggleProperty).toHaveBeenLastCalledWith('inventoried', true)
    await user.click(screen.getByRole('switch', { name: 'Featured' }))
    expect(props.handleToggleProperty).toHaveBeenLastCalledWith('featured', false)
    await user.click(screen.getByRole('switch', { name: 'Upselling' }))
    expect(props.handleToggleProperty).toHaveBeenLastCalledWith('upselling', true)
  })

  it('puts the switch back and says why when the save fails', async () => {
    const user = userEvent.setup()
    mount({ handleToggleProperty: vi.fn().mockResolvedValue({ ok: false, error: ['Nope'] }) })
    await user.click(screen.getByRole('switch', { name: 'Upselling' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Nope')).toBeTruthy()
    expect(switchChecked('Upselling')).toBe('false')
    expect(switchChecked('Featured')).toBe('true')
  })

  it('says its own text when the failure has none', async () => {
    const user = userEvent.setup()
    mount({ handleToggleProperty: vi.fn().mockResolvedValue({ ok: false }) })
    await user.click(screen.getByRole('switch', { name: 'Featured' }))
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't save the change.")
    expect(switchChecked('Featured')).toBe('true')
  })
})

describe('BusinessSharedMenuProductDetails · product options', () => {
  it('has no options section without extras', () => {
    mount()
    expect(screen.queryByText('Product options')).toBeNull()
    expect(screen.queryAllByRole('searchbox')).toHaveLength(0)
  })

  it('shows options of an enabled extra and suboptions of an enabled option only', () => {
    mount(withExtras())
    expect(screen.getByRole('heading', { level: 4, name: 'Product options' })).toBeTruthy()
    // extras always; options only under an enabled extra; suboptions only under an enabled option
    expect(screen.getByRole('switch', { name: 'Size' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Sauce' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Large' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Small' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Extra cheese' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Hidden sub' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'BBQ' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Smoky' })).toBeNull()
    expect(switchChecked('Size')).toBe('true')
    expect(switchChecked('Sauce')).toBe('false')
    expect(switchChecked('Small')).toBe('false')
  })

  it('saves each level through its own handler, with the id and the next value', async () => {
    const user = userEvent.setup()
    const { props } = mount(withExtras())
    await user.click(screen.getByRole('switch', { name: 'Sauce' }))
    expect(props.handleUpdateExtra).toHaveBeenCalledWith(2, true)
    await user.click(screen.getByRole('switch', { name: 'Small' }))
    expect(props.handleUpdateOption).toHaveBeenCalledWith(11, true)
    await user.click(screen.getByRole('switch', { name: 'Extra cheese' }))
    expect(props.handleUpdateSuboption).toHaveBeenCalledWith(100, true)
  })

  it('puts an option switch back and says why when it fails', async () => {
    const user = userEvent.setup()
    mount({ ...withExtras(), handleUpdateOption: vi.fn().mockResolvedValue({ ok: false, error: ['Option locked'] }) })
    await user.click(screen.getByRole('switch', { name: 'Small' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Option locked')
    expect(switchChecked('Small')).toBe('false')
    expect(switchChecked('Large')).toBe('true')
  })

  it('searches extras, options and suboptions without telling case, on both sides', async () => {
    const user = userEvent.setup()
    mount(withExtras())
    const search = screen.getByRole('searchbox', { name: 'Search' })

    // a suboption matches: its extra and its option stay, the others go
    await user.type(search, 'CHEESE')
    expect(screen.getByRole('switch', { name: 'Size' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Large' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Extra cheese' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Small' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Sauce' })).toBeNull()

    // an option of a disabled extra keeps the extra but its options still wait for it to be enabled
    await user.clear(search)
    await user.type(search, 'bbq')
    expect(screen.getByRole('switch', { name: 'Sauce' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'BBQ' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Size' })).toBeNull()

    // an extra name in upper case is found by a lower case term
    await user.clear(search)
    await user.type(search, 'SIZE')
    expect(screen.getByRole('switch', { name: 'Size' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Large' })).toBeNull()
  })
})

describe('BusinessSharedMenuProductDetails · the save bar', () => {
  it('is not there with nothing to save', () => {
    mount()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('counts, names the fields, and Save and Discard call the controller', async () => {
    const user = userEvent.setup()
    const { props } = mount({ isDirty: true, pendingChangeKeys: ['price', 'quantity'] })
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByText('2 unsaved changes')).toBeTruthy()
    expect(bar.textContent).toContain('Price, Quantity')

    await user.click(within(bar).getByRole('button', { name: 'Save' }))
    expect(props.saveChanges).toHaveBeenCalledTimes(1)
    await user.click(within(bar).getByRole('button', { name: 'Discard' }))
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
  })

  it('says «1 unsaved change» for one', () => {
    mount({ isDirty: true, pendingChangeKeys: ['price'] })
    expect(within(screen.getByRole('group', { name: 'Save changes' })).getByText('1 unsaved change')).toBeTruthy()
  })

  it('shows the error of the controller, translated, with Retry that saves again', async () => {
    const user = userEvent.setup()
    const { props } = mount({
      isDirty: true,
      pendingChangeKeys: ['price'],
      formState: { changes: { price: 1 }, saving: false, error: ['Price too low'] }
    })
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByRole('alert').textContent).toContain('Price too low')
    await user.click(within(bar).getByRole('button', { name: 'Retry' }))
    expect(props.saveChanges).toHaveBeenCalledTimes(1)
  })

  it('falls back to its own text when the error has no message', () => {
    mount({
      isDirty: true,
      pendingChangeKeys: ['price'],
      formState: { changes: { price: 1 }, saving: false, error: [] }
    })
    // an empty list is not an error to draw; a list without text is
    expect(screen.queryByRole('alert')).toBeNull()
    cleanup()
    mount({
      isDirty: true,
      pendingChangeKeys: ['price'],
      formState: { changes: { price: 1 }, saving: false, error: [{}] }
    })
    expect(within(screen.getByRole('group', { name: 'Save changes' })).getByRole('alert').textContent).toContain("We couldn't save the change.")
  })

  it('is busy while it saves', () => {
    mount({ isDirty: true, pendingChangeKeys: ['price'], formState: { changes: { price: 1 }, saving: true, error: null } })
    expect(screen.getByRole('group', { name: 'Save changes' }).getAttribute('data-saving')).toBe('')
  })

  it('says «Saved» once a save went well', async () => {
    const user = userEvent.setup()
    const Stateful = () => {
      const [dirty, setDirty] = useState(true)
      const props = buildProps({
        isDirty: dirty,
        pendingChangeKeys: dirty ? ['price'] : [],
        saveChanges: async () => { setDirty(false); return { ok: true } }
      })
      return <BusinessSharedMenuProductDetails {...props} />
    }
    renderWithProviders(<Stateful />)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('status')).textContent).toContain('Saved')
  })
})

describe('BusinessSharedMenuProductDetails · leave guard (decision 4)', () => {
  const lastGuardArgs = () => mocks.useLeaveGuard.mock.calls.at(-1)[0]

  it('registers the form with the dirty state, the count and the controller handlers', async () => {
    const { props } = mount({ isDirty: true, pendingChangeKeys: ['price', 'quantity'] })
    const args = lastGuardArgs()
    expect(args.dirty).toBe(true)
    expect(args.count).toBe(2)
    expect(typeof args.registerCloseGuard).toBe('function')
    await args.save()
    expect(props.saveChanges).toHaveBeenCalledTimes(1)
    args.discard()
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
  })

  it('is clean when the controller says so, and counts at least one', () => {
    mount()
    expect(lastGuardArgs().dirty).toBe(false)
    expect(lastGuardArgs().count).toBe(1)
  })

  it('closing the piece asks the host first when there is unsaved work', async () => {
    const user = userEvent.setup()
    const host = { register: vi.fn(() => () => {}), registerNested: vi.fn(() => () => {}), requestLeave: vi.fn(() => true) }
    const onClose = vi.fn()
    const props = buildProps({ isDirty: true, pendingChangeKeys: ['price'] })
    renderWithProviders(
      <LeaveGuardContext.Provider value={host}>
        <SectionSplit
          open
          detailKey='1'
          detailTitle='Burger'
          closeLabel='Close'
          backLabel='Products'
          onClose={onClose}
          list={<div>the list</div>}
          detail={<BusinessSharedMenuProductDetails {...props} />}
        />
      </LeaveGuardContext.Provider>
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(host.requestLeave).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('BusinessSharedMenuProductDetails · source', () => {
  const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')

  it('uses no legacy inputs, icons or styled-components', () => {
    expect(source).not.toMatch(/react-bootstrap/)
    expect(source).not.toMatch(/styled-components/)
    expect(source).not.toMatch(/from '\.\/styles'/)
    expect(source).not.toMatch(/from '\.\.\/\.\.\/\.\.\/styles'/)
  })
})
