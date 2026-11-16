/* eslint-disable import/first */
// redesign SL-F1 (A2): the Enable and Featured switches of a store row (M-12). The switch is controlled by the stored value of the
// record, busy while it saves, and when the save fails (`{ ok: false, error }`, which A3 makes `handleChangeActiveBusiness` return)
// it goes back to the stored value and says so in the row. In `main` it stayed in the flipped position with the old data and nothing
// said so (inventory 1.8). The BusinessDetails controller is a stand-in with the contract that matters here: it keeps `businessState`,
// updates it only on a successful save, and fires `handleSucessUpdateBusiness` from its effect, as the real one does.
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  controllerProps: null,
  mounts: 0, // BusinessDetails controllers mounted
  saves: [],
  result: undefined, // what handleChangeActiveBusiness resolves to: undefined (today), { ok: true } or { ok: false, error }
  gate: null // a promise the save waits for, to look at the switch while it is busy
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    BusinessDetails: ({ UIComponent, ...props }) => {
      mockState.controllerProps = props
      const { business, handleSucessUpdateBusiness } = props
      const [state, setState] = react.useState({ business, loading: false })
      react.useEffect(() => {
        mockState.mounts += 1
      }, [])
      react.useEffect(() => {
        handleSucessUpdateBusiness?.(state.business)
      }, [state.business])
      const handleChangeActiveBusiness = async (value, isFeatured = false) => {
        mockState.saves.push({ id: business.id, value, isFeatured })
        if (mockState.gate) await mockState.gate
        const failed = mockState.result?.ok === false
        if (!failed) setState(current => ({ ...current, business: { ...current.business, [isFeatured ? 'featured' : 'enabled']: value } }))
        return mockState.result
      }
      return <UIComponent {...props} businessState={state} actionStatus={{ loading: false, error: null }} handleChangeActiveBusiness={handleChangeActiveBusiness} />
    }
  }
})

import { StoreRowSwitch } from '../StoreRowSwitch'

const STORE = { id: 7, name: 'Sample Burgers', enabled: true, featured: false }

const draw = (props = {}) => render(
  <StoreRowSwitch business={STORE} label='Enable Sample Burgers' {...props} />
)

// redesign (owner decision 31 A): switching a store off asks first; this answers «Deactivate store»
const confirmOff = async (user) => {
  const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Sample Burgers?' })
  await user.click(within(dialog).getByRole('button', { name: 'Deactivate store' }))
}

beforeEach(() => {
  mockState.controllerProps = null
  mockState.mounts = 0
  mockState.saves = []
  mockState.result = undefined
  mockState.gate = null
})

describe('StoreRowSwitch — the controller of the row', () => {
  it('mounts the BusinessDetails controller with the business and no request of its own, as SingleBusiness did', () => {
    draw()
    expect(mockState.controllerProps.business).toBe(STORE)
    expect(mockState.controllerProps.businessId).toBe(7)
    expect(mockState.controllerProps.notGetSites).toBe(true)
    expect(mockState.controllerProps.notGetTaxes).toBe(true)
    expect(mockState.controllerProps.notGetStreamConnection).toBe(true)
    // (G1-31) asked for no /third_party_integrations per card; since main 4b7ff4f9 the controller asks for none at all
    expect(mockState.controllerProps).not.toHaveProperty('notGetCloverIntegration')
  })

  it('keeps handleSucessUpdateBusiness firing from the controller', async () => {
    const handleSucessUpdateBusiness = vi.fn()
    draw({ handleSucessUpdateBusiness })
    await waitFor(() => expect(handleSucessUpdateBusiness).toHaveBeenCalledWith(STORE))
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'Enable Sample Burgers' }))
    await confirmOff(user)
    await waitFor(() => expect(handleSucessUpdateBusiness).toHaveBeenLastCalledWith({ ...STORE, enabled: false }))
  })
})

describe('StoreRowSwitch — the value of the record', () => {
  it('shows the stored value of the field it is for', () => {
    const { unmount } = draw({ field: 'enabled' })
    expect(screen.getByRole('switch', { name: 'Enable Sample Burgers' })).toBeChecked()
    unmount()
    draw({ field: 'featured', label: 'Featured Sample Burgers' })
    expect(screen.getByRole('switch', { name: 'Featured Sample Burgers' })).not.toBeChecked()
  })

  it('saves Enable as handleChangeActiveBusiness(value) and Featured as (value, true)', async () => {
    const user = userEvent.setup()
    const { unmount } = draw({ field: 'enabled' })
    await user.click(screen.getByRole('switch', { name: 'Enable Sample Burgers' }))
    await confirmOff(user)
    await waitFor(() => expect(mockState.saves).toEqual([{ id: 7, value: false, isFeatured: false }]))
    unmount()
    draw({ field: 'featured', label: 'Featured Sample Burgers' })
    await user.click(screen.getByRole('switch', { name: 'Featured Sample Burgers' }))
    await waitFor(() => expect(mockState.saves[1]).toEqual({ id: 7, value: true, isFeatured: true }))
  })

  it('names itself with the visible text when it has one, and the whole text toggles', async () => {
    draw({ children: 'Enable' })
    const toggle = screen.getByRole('switch', { name: 'Enable Sample Burgers' })
    expect(toggle).toHaveTextContent('Enable')
    const user = userEvent.setup()
    await user.click(screen.getByText('Enable'))
    await confirmOff(user)
    await waitFor(() => expect(toggle).not.toBeChecked())
  })
})

describe('StoreRowSwitch — saving', () => {
  it('is busy while it saves, shows the value being saved, and ignores a second press', async () => {
    const user = userEvent.setup()
    let release
    mockState.gate = new Promise(resolve => { release = resolve })
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Sample Burgers' })
    await user.click(toggle)
    await confirmOff(user)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-busy', 'true'))
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(mockState.saves).toHaveLength(1)
    await act(async () => { release() })
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
    expect(toggle).not.toBeChecked() // the record now says so
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('treats a controller that returns nothing as a success (today, before A3)', async () => {
    mockState.result = undefined
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Sample Burgers' })
    const user = userEvent.setup()
    await user.click(toggle)
    await confirmOff(user)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('StoreRowSwitch — M-12: a save that fails', () => {
  it('goes back to the stored value and says why in the row', async () => {
    const user = userEvent.setup()
    mockState.result = { ok: false, error: ['Internal error'] }
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Sample Burgers' })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    await confirmOff(user)
    await waitFor(() => expect(mockState.saves).toHaveLength(1))
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Internal error')
    expect(toggle).toBeChecked() // back to the stored value, not left flipped
    expect(toggle).not.toHaveAttribute('aria-busy')
  })

  it('says a short message of its own when the error has no text, and reads the message of an error object', async () => {
    const user = userEvent.setup()
    mockState.result = { ok: false, error: undefined }
    const { unmount } = draw()
    await user.click(screen.getByRole('switch', { name: 'Enable Sample Burgers' }))
    await confirmOff(user)
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the change.")
    unmount()

    mockState.result = { ok: false, error: { message: 'Network down' } }
    draw()
    await user.click(screen.getByRole('switch', { name: 'Enable Sample Burgers' }))
    await confirmOff(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })

  it('works the same for Featured, and a new attempt clears the notice', async () => {
    const user = userEvent.setup()
    mockState.result = { ok: false, error: ['Not allowed'] }
    draw({ field: 'featured', label: 'Featured Sample Burgers' })
    const toggle = screen.getByRole('switch', { name: 'Featured Sample Burgers' })
    await user.click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(toggle).not.toBeChecked()

    mockState.result = { ok: true }
    await user.click(toggle)
    await waitFor(() => expect(toggle).toBeChecked())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('StoreRowSwitch — (owner decision 31 A): switching a store off asks first', () => {
  it('asks before saving Enabled off, naming the store; Cancel saves nothing and the switch stays on', async () => {
    const user = userEvent.setup()
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Sample Burgers' })
    await user.click(toggle)
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Sample Burgers?' })
    expect(within(dialog).getByText("Customers won't be able to order from it until you turn it back on.")).toBeInTheDocument()
    expect(toggle).toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(mockState.saves).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mockState.saves).toEqual([])
    expect(toggle).toBeChecked()
  })

  it('saves Enabled off as today once confirmed', async () => {
    const user = userEvent.setup()
    draw()
    const toggle = screen.getByRole('switch', { name: 'Enable Sample Burgers' })
    await user.click(toggle)
    await confirmOff(user)
    await waitFor(() => expect(mockState.saves).toEqual([{ id: 7, value: false, isFeatured: false }]))
    await waitFor(() => expect(toggle).not.toBeChecked())
  })

  it('switches a store on at once, with no question', async () => {
    const user = userEvent.setup()
    draw({ business: { ...STORE, enabled: false } })
    await user.click(screen.getByRole('switch', { name: 'Enable Sample Burgers' }))
    await waitFor(() => expect(mockState.saves).toEqual([{ id: 7, value: true, isFeatured: false }]))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('leaves Featured immediate in both directions', async () => {
    const user = userEvent.setup()
    draw({ field: 'featured', label: 'Featured Sample Burgers', business: { ...STORE, featured: true } })
    await user.click(screen.getByRole('switch', { name: 'Featured Sample Burgers' }))
    await waitFor(() => expect(mockState.saves).toEqual([{ id: 7, value: false, isFeatured: true }]))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

// redesign stores 3.B, G1-23: StoreRowControllers is one saver for the page now, no controller per row; its tests (and
// the equivalence with this controller) are in StoreRowSaver.test.jsx.
