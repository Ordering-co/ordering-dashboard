/* eslint-disable import/first */
// redesign SL-F1 (A2): the selection bar of /stores/list. Five verbs instead of two unnamed switches. In `main` Enable, Disable, Feature
// and Unfeature acted at once; now each asks first (a ConfirmDialog with the verb, the count and the names, C8; the focus starts on
// Cancel) and only the confirmation calls the controller's `handleEnableAllBusiness(value, isFeatured)`. Delete keeps the password
// check of ConfirmAdmin (a stand-in here), with the same words, and calls `handleDeleteMultiBusinesses`.
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ restricted: false, admin: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../../hooks/useFeaturedRestriction', () => ({
  useFeaturedRestriction: () => mockState.restricted
}))
// ConfirmAdmin is the password / OTP check (CheckPassword controller): here only the words it is given and its two exits
vi.mock('../../../Shared/UI/ConfirmAdmin', () => ({
  ConfirmAdmin: (props) => {
    mockState.admin = props
    return props.open
      ? (
        <div role='dialog' aria-label={props.title}>
          <p>{props.description}</p>
          <button type='button' onClick={props.onConfirm}>{props.confirmLabel}</button>
          <button type='button' onClick={props.onClose}>Close admin check</button>
        </div>
        )
      : null
  }
}))

import { StoresBulkBar } from '../StoresBulkBar'

const PAGE = {
  loading: false,
  error: null,
  businesses: [
    { id: 1, name: 'Sample Burgers' },
    { id: 2, name: 'Demo Bakery' },
    { id: 3, name: 'Test Wok' }
  ]
}

const draw = (props = {}) => {
  const handlers = {
    setBusinessIds: vi.fn(),
    handleEnableAllBusiness: vi.fn(),
    handleDeleteMultiBusinesses: vi.fn()
  }
  const utils = render(<StoresBulkBar businessIds={[1, 2]} businessList={PAGE} {...handlers} {...props} />)
  return { ...utils, ...handlers }
}

beforeEach(() => {
  mockState.restricted = false
  mockState.admin = null
})
afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

describe('StoresBulkBar — the bar', () => {
  it('paints nothing with no selection', () => {
    const { container } = draw({ businessIds: [] })
    expect(container).toBeEmptyDOMElement()
  })

  it('is a region that says how many are selected, with the five verbs and Clear', () => {
    draw()
    const bar = screen.getByRole('region', { name: 'Actions for selected stores' })
    expect(within(bar).getByRole('status')).toHaveTextContent('2 selected')
    ;['Enable', 'Disable', 'Feature', 'Unfeature', 'Delete'].forEach(name => {
      expect(within(bar).getByRole('button', { name })).toBeInTheDocument()
    })
    expect(within(bar).getByRole('button', { name: 'Clear selection' })).toBeInTheDocument()
  })

  it('leaves Feature and Unfeature out when the Featured column is not for this session (EatStreet owner)', () => {
    mockState.restricted = true
    draw()
    expect(screen.queryByRole('button', { name: 'Feature' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unfeature' })).toBeNull()
    ;['Enable', 'Disable', 'Delete'].forEach(name => expect(screen.getByRole('button', { name })).toBeInTheDocument())
  })

  // redesign stores 3.B, decision 12a (G1-24): only the verbs that change something for the stores selected
  const withStates = (enabled) => ({ ...PAGE, businesses: PAGE.businesses.map(business => ({ ...business, enabled: enabled[business.id] })) })
  const verbs = () => screen.getAllByRole('button').filter(button => button.hasAttribute('data-bulk-action')).map(button => button.textContent.trim())

  it('offers Disable and not Enable when every store selected is enabled (the Active tab)', () => {
    draw({ businessList: withStates({ 1: true, 2: true, 3: false }) })
    expect(verbs()).toEqual(['Disable', 'Feature', 'Unfeature', 'Delete'])
  })

  it('offers Enable and not Disable when every store selected is disabled (the Inactive tab)', () => {
    draw({ businessList: withStates({ 1: false, 2: false, 3: true }) })
    expect(verbs()).toEqual(['Enable', 'Feature', 'Unfeature', 'Delete'])
  })

  it('offers both for a selection that holds stores of both tabs, remembering stores no longer on screen (review r1 #3)', () => {
    const { rerender, setBusinessIds, handleEnableAllBusiness, handleDeleteMultiBusinesses } = draw({ businessList: withStates({ 1: true, 2: true, 3: true }) })
    // the person goes to the Inactive tab and selects one more: the first two are no longer on screen
    const inactive = { ...PAGE, businesses: [{ id: 9, name: 'Closed Diner', enabled: false }] }
    rerender(<StoresBulkBar businessIds={[1, 2, 9]} businessList={inactive} setBusinessIds={setBusinessIds} handleEnableAllBusiness={handleEnableAllBusiness} handleDeleteMultiBusinesses={handleDeleteMultiBusinesses} />)
    expect(verbs()).toEqual(['Enable', 'Disable', 'Feature', 'Unfeature', 'Delete'])
  })

  it('offers both for a selected store it never saw', () => {
    draw({ businessIds: [1, 99], businessList: withStates({ 1: true }) })
    expect(verbs()).toEqual(['Enable', 'Disable', 'Feature', 'Unfeature', 'Delete'])
  })

  it('a restricted session over enabled stores gets Disable and Delete', () => {
    mockState.restricted = true
    draw({ businessList: withStates({ 1: true, 2: true }) })
    expect(verbs()).toEqual(['Disable', 'Delete'])
  })

  it('Clear empties the selection in the controller', async () => {
    const { setBusinessIds } = draw()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(setBusinessIds).toHaveBeenCalledWith([])
  })

  it('Esc inside the bar clears the selection too', async () => {
    const { setBusinessIds } = draw()
    const user = userEvent.setup()
    screen.getByRole('button', { name: 'Enable' }).focus()
    await user.keyboard('{Escape}')
    expect(setBusinessIds).toHaveBeenCalledWith([])
  })
})

describe('StoresBulkBar — state changes ask first (C8)', () => {
  it.each([
    ['Enable', 'Enable 2 stores?', 'Enable 2 stores', [true, false]],
    ['Disable', 'Disable 2 stores?', 'Disable 2 stores', [false, false]],
    ['Feature', 'Feature 2 stores?', 'Feature 2 stores', [true, true]],
    ['Unfeature', 'Unfeature 2 stores?', 'Unfeature 2 stores', [false, true]]
  ])('%s: nothing happens until the dialog is confirmed, then it is handleEnableAllBusiness%j', async (verb, title, confirmLabel, args) => {
    const user = userEvent.setup()
    const { handleEnableAllBusiness, handleDeleteMultiBusinesses } = draw()
    await user.click(screen.getByRole('button', { name: verb }))

    const dialog = await screen.findByRole('alertdialog', { name: title })
    expect(handleEnableAllBusiness).not.toHaveBeenCalled()
    expect(within(dialog).getByText(/Sample Burgers, Demo Bakery/)).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())

    await user.click(within(dialog).getByRole('button', { name: confirmLabel }))
    expect(handleEnableAllBusiness).toHaveBeenCalledTimes(1)
    expect(handleEnableAllBusiness).toHaveBeenCalledWith(...args)
    expect(handleDeleteMultiBusinesses).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Cancel, the close button and Esc change nothing', async () => {
    const user = userEvent.setup()
    const { handleEnableAllBusiness } = draw()
    await user.click(screen.getByRole('button', { name: 'Disable' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Disable' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleEnableAllBusiness).not.toHaveBeenCalled()
  })

  it('names the stores of the page it knows and counts the rest of the selection as «+N more»', async () => {
    const user = userEvent.setup()
    // five selected: three of this page (all named, three is the limit) and two from other pages
    draw({ businessIds: [1, 2, 3, 40, 41] })
    expect(screen.getByRole('status')).toHaveTextContent('5 selected')
    await user.click(screen.getByRole('button', { name: 'Disable' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Disable 5 stores?' })
    expect(within(dialog).getByText('Sample Burgers, Demo Bakery, Test Wok +2 more will be disabled.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Disable 5 stores' })).toBeInTheDocument()
  })

  it('says «1 store» for a selection of one', async () => {
    const user = userEvent.setup()
    draw({ businessIds: [2] })
    await user.click(screen.getByRole('button', { name: 'Feature' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Feature 1 store?' })
    expect(within(dialog).getByText('Demo Bakery will be featured.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Feature 1 store' })).toBeInTheDocument()
  })
})

describe('StoresBulkBar — Delete keeps the password check', () => {
  it('opens ConfirmAdmin with the title, the names and the button of the delete copy, and no second dialog', async () => {
    const user = userEvent.setup()
    const { handleDeleteMultiBusinesses, handleEnableAllBusiness } = draw()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const check = screen.getByRole('dialog', { name: 'Delete 2 stores?' })
    expect(within(check).getByText('Sample Burgers, Demo Bakery will be deleted.')).toBeInTheDocument()
    expect(mockState.admin.open).toBe(true)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(handleDeleteMultiBusinesses).not.toHaveBeenCalled()

    await user.click(within(check).getByRole('button', { name: 'Delete 2 stores' }))
    expect(handleDeleteMultiBusinesses).toHaveBeenCalledTimes(1)
    expect(handleEnableAllBusiness).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Delete 2 stores?' })).toBeNull()
  })

  it('closing the check deletes nothing', async () => {
    const user = userEvent.setup()
    const { handleDeleteMultiBusinesses } = draw()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Close admin check' }))
    expect(handleDeleteMultiBusinesses).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Delete 2 stores?' })).toBeNull()
  })

  // ConfirmAdmin now checks the password or the code server-side (action `businesses_delete`)
  // and hands over the one-time confirmation_token, which the DELETE must carry.
  it('asks ConfirmAdmin for the businesses_delete action and forwards its confirmation_token', async () => {
    const user = userEvent.setup()
    const { handleDeleteMultiBusinesses } = draw()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(mockState.admin.action).toBe('businesses_delete')

    act(() => { mockState.admin.onConfirm('tok-biz-9') })
    expect(handleDeleteMultiBusinesses).toHaveBeenCalledWith('tok-biz-9')
  })
})

// redesign bugs F row 20 (R-05): the bar unmounts when the selection empties (a confirmed verb, a delete, «Clear
// selection»), and the focus it held fell to <body>. It goes to `fallbackFocus()` instead (the list's «Select all»).
describe('StoresBulkBar · the focus when the bar goes away (row 20)', () => {
  const Page = ({ ids, onClear }) => (
    <>
      <input type='checkbox' aria-label='Select all stores' />
      <StoresBulkBar
        businessIds={ids}
        businessList={PAGE}
        setBusinessIds={onClear}
        handleEnableAllBusiness={vi.fn()}
        handleDeleteMultiBusinesses={vi.fn()}
        fallbackFocus={() => document.querySelector('[aria-label="Select all stores"]')}
      />
    </>
  )

  it('«Clear selection» empties it: the focus goes to the fallback, not to <body>', async () => {
    const user = userEvent.setup()
    const view = render(<Page ids={[1, 2]} onClear={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    view.rerender(<Page ids={[]} onClear={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('Select all stores')).toHaveFocus())
  })

  it('a focus the user put somewhere else meanwhile stays there', async () => {
    const user = userEvent.setup()
    const view = render(<><button type='button'>Elsewhere</button><Page ids={[1, 2]} onClear={vi.fn()} /></>)
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    view.rerender(<><button type='button'>Elsewhere</button><Page ids={[]} onClear={vi.fn()} /></>)
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus()
  })
})

// review R-7 (bugs F): a dialog that is still open when the selection empties keeps its focus
describe('StoresBulkBar · a dialog open when the bar goes away (R-7)', () => {
  it('does not take the focus out of an open dialog', async () => {
    const Page = ({ ids }) => (
      <>
        <input type='checkbox' aria-label='Select all stores' />
        <div role='dialog' aria-label='Other'><button type='button'>Inside</button></div>
        <StoresBulkBar businessIds={ids} businessList={PAGE} setBusinessIds={vi.fn()} handleEnableAllBusiness={vi.fn()} handleDeleteMultiBusinesses={vi.fn()} fallbackFocus={() => document.querySelector('[aria-label="Select all stores"]')} />
      </>
    )
    const view = render(<Page ids={[1, 2]} />)
    screen.getByRole('button', { name: 'Inside' }).focus()
    view.rerender(<Page ids={[]} />)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus()
  })
})
