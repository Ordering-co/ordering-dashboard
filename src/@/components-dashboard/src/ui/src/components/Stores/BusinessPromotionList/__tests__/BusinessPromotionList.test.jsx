/* eslint-disable import/first */
// redesign stores 5.14 (; E4): the promotions of a store on Product, in place of the legacy table, the 80 % Modal and the
// Confirm of `main`. Covered: the columns (percentage, amount, minimum, coupon code, automatic, dates in the project's format and never
// ISO, Expired / Scheduled against a fixed today), loading / error / empty as three different things (G4-16), the switch of a row (the
// controller with `inlineError`, back and the reason when it fails, never opens the row), opening a row (the form receives its record
// and the callbacks of the contract), a new promotion (no tabs), the tabs of a saved one (a change of tab goes through the leave guard
// of the split), the delete (confirmed with the name, a failure stays in the confirmation, a success closes the detail), the thumbnail
// that falls to the placeholder when its image fails (A-1) and the cards under 768px. The controller is a stand-in that keeps the list
// like the real one; the general form and the custom fields are stood in (they have their own tests): the props they receive are the
// contract with them.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const probe = vi.hoisted(() => ({
  state: { promotions: [], loading: false, error: null },
  phone: false,
  controllerProps: null,
  formProps: null,
  fieldsProps: null,
  guard: null,
  asked: new Set(),
  spies: { reload: null, toggle: null, remove: null, extend: null, success: null },
  answers: {}
}))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  const { default: moment } = await import('moment')
  return {
    useLanguage: () => [{}, (key, fallback) => { probe.asked.add(key); return fallback }],
    // the real parseDate, reduced to a project format that is not ISO
    useUtils: () => [{
      parsePrice: (value) => `$${Number(value).toFixed(2)}`,
      parseDate: (value) => moment(value, 'YYYY-MM-DD HH:mm:ss').format('DD MMM YYYY')
    }],
    BusinessPromotionList: ({ UIComponent, ...props }) => {
      probe.controllerProps = props
      const [promotions, setPromotions] = ReactModule.useState(probe.state.promotions)
      const toggle = async (enabled, id, options) => {
        probe.spies.toggle?.(enabled, id, options)
        if (probe.answers.toggle) return probe.answers.toggle
        setPromotions(prev => prev.map(promotion => (promotion.id === id ? { ...promotion, enabled } : promotion)))
        return { ok: true, result: { id, enabled } }
      }
      const remove = async (id, options) => {
        probe.spies.remove?.(id, options)
        if (probe.answers.remove) return probe.answers.remove
        setPromotions(prev => prev.filter(promotion => promotion.id !== id))
        return { ok: true, result: true }
      }
      return ReactModule.createElement(UIComponent, {
        ...props,
        promotionListState: { ...probe.state, promotions },
        reloadPromotions: (...args) => probe.spies.reload?.(...args),
        handleChangePromotionActiveState: toggle,
        handleDeletePromotion: remove
      })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1440, height: 900 }) }))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => probe.phone }))

// The general form, reduced to what the list has to give it. «Make dirty» registers a guard in the split, like a form with unsaved work.
vi.mock('../../BusinessPromotionGeneralForm', async () => {
  const ReactModule = await import('react')
  const { useSectionSplit } = await import('../../../Shared/Product/SectionSplit')
  return {
    BusinessPromotionGeneralForm: (props) => {
      probe.formProps = props
      const { registerCloseGuard } = useSectionSplit()
      const [dirty, setDirty] = ReactModule.useState(false)
      ReactModule.useEffect(() => {
        if (!dirty) return undefined
        return registerCloseGuard((proceed) => { probe.guard = proceed; return true })
      }, [dirty, registerCloseGuard])
      return (
        <div data-testid='general-form'>
          <span>{`form:${props.promotion?.name ?? 'new'}:${props.promotion?.enabled}`}</span>
          <button type='button' onClick={() => setDirty(true)}>Make dirty</button>
          <button type='button' onClick={() => props.onCreated({ id: 99, name: 'Created one', enabled: true })}>Create it</button>
          <button type='button' onClick={() => props.onSaved({ id: props.promotion.id, name: 'Renamed' })}>Save it</button>
          <button type='button' onClick={() => props.onClose()}>Close it</button>
        </div>
      )
    }
  }
})
vi.mock('../../BusinessPromotionCustomFields', () => ({
  BusinessPromotionCustomFields: (props) => {
    probe.fieldsProps = props
    return <div data-testid='custom-fields'>{`fields:${props.businessId}:${props.offerId}`}</div>
  }
}))

import { BusinessPromotionList } from '../index'
import { PromotionsTable } from '../PromotionsTable'

const COUPON = { id: 1, name: 'Summer sale', type: 2, coupon: 'SUMMER', rate_type: 1, rate: '20.00', minimum: 0, enabled: true, auto: false, image: 'https://img.test/summer.png', start: '2026-03-05 00:00:00', end: '2026-03-20 23:59:59' }
const FREE = { id: 2, name: 'Free shipping', type: 1, coupon: null, rate_type: 2, rate: 5, minimum: '20.00', enabled: false, auto: true, image: null, start: '2026-10-20 00:00:00', end: '2026-12-31 23:59:59' }
const LIVE = { id: 3, name: 'Live today', type: 1, coupon: null, rate_type: 1, rate: 10, minimum: null, enabled: true, auto: false, image: 'https://img.test/live.png', start: '2026-10-01 00:00:00', end: '2026-10-31 23:59:59' }
const BUSINESS = { id: 7, name: 'Burger', offers: [] }

const renderList = (props = {}) => renderWithProviders(
  <BusinessPromotionList
    promotions={probe.state.promotions}
    businessId={7}
    business={BUSINESS}
    setIsExtendExtraOpen={probe.spies.extend}
    handleSuccessUpdate={probe.spies.success}
    {...props}
  />,
  { theme: { colors: { primary: '#E63757', backgroundPage: '#ffffff', headingColor: '#344054', lightGray: '#f5f5f5', borderColor: '#e9ecef' }, images: { dummies: { promotionDummy: 'dummy-promotion.png' } } } }
)

// Beside an open detail the list shows cards (links) instead of table rows: the helpers find either.
const rowOf = (name) => screen.queryByRole('row', { name: new RegExp(name) }) ?? screen.getByRole('link', { name: `${name}, View details` }).closest('li')
const openButton = (name) => screen.queryByRole('button', { name: `${name}, View details` }) ?? screen.getByRole('link', { name: `${name}, View details` })
const detailOf = (title) => screen.getByRole('heading', { level: 3, name: title })

beforeEach(() => {
  // only the clock: timers and animation frames stay real
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0)) // 10 Oct 2026, local time
  probe.state = { promotions: [], loading: false, error: null }
  probe.phone = false
  probe.controllerProps = null
  probe.formProps = null
  probe.fieldsProps = null
  probe.guard = null
  probe.asked = new Set()
  probe.spies = { reload: vi.fn(), toggle: vi.fn(), remove: vi.fn(), extend: vi.fn(), success: vi.fn() }
  probe.answers = {}
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BusinessPromotionList table (S-1, S-2)', () => {
  it('keeps the controller props of before and is a Product root with the section title and one primary button', () => {
    probe.state.promotions = [COUPON]
    const { container } = renderList()
    expect(container.querySelector('.odc-root.odc-bpl')).not.toBeNull()
    expect(probe.controllerProps).toMatchObject({ businessId: 7, business: BUSINESS })
    expect(screen.getByRole('heading', { level: 2, name: 'Promotions' })).toBeInTheDocument()
    // the duplicated link of the foot is gone: one «Add promotion» while the list has rows
    expect(screen.getAllByRole('button', { name: 'Add promotion' })).toHaveLength(1)
    expect(screen.queryByText('Add new promotion')).toBeNull()
  })

  it('draws a Product table with the five columns', () => {
    probe.state.promotions = [COUPON, FREE]
    renderList()
    const table = screen.getByRole('table', { name: 'Promotions' })
    expect(table.classList.contains('odc-table')).toBe(true)
    for (const name of ['Promotion', 'Type', 'Discount', 'Date range', 'Status']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
  })

  it('says the type, with the coupon code as a figure and «Automatic» when it is', () => {
    probe.state.promotions = [COUPON, FREE]
    renderList()
    expect(rowOf('Summer sale')).toHaveTextContent('Coupon · SUMMER')
    expect(rowOf('Summer sale').querySelector('.odc-bpl-type .odc-figure')).toHaveTextContent('SUMMER')
    expect(rowOf('Free shipping')).toHaveTextContent('Discount · Automatic')
    expect(rowOf('Free shipping')).not.toHaveTextContent('Coupon')
  })

  it('says how much it discounts: a percentage, or an amount in the currency of the project, and the minimum under it', () => {
    probe.state.promotions = [COUPON, FREE]
    renderList()
    expect(rowOf('Summer sale').querySelector('.odc-bpl-discount > .odc-figure')).toHaveTextContent('20 %')
    expect(rowOf('Summer sale').querySelector('.odc-bpl-sub')).toBeNull() // no minimum: nothing under it
    expect(rowOf('Free shipping').querySelector('.odc-bpl-discount > .odc-figure')).toHaveTextContent('$5.00')
    expect(rowOf('Free shipping').querySelector('.odc-bpl-discount .odc-bpl-sub')).toHaveTextContent('Min. $20.00')
  })

  it('writes the dates in the format of the project, never ISO', () => {
    probe.state.promotions = [COUPON]
    renderList()
    const row = rowOf('Summer sale')
    expect(row).toHaveTextContent('05 Mar 2026 – 20 Mar 2026')
    expect(row).not.toHaveTextContent('2026-03-05')
    expect(row).not.toHaveTextContent('2026-03-20')
  })

  it('says Expired when the end is past and Scheduled when the start is ahead, and nothing when it is running (against a fixed today)', () => {
    probe.state.promotions = [COUPON, FREE, LIVE]
    renderList()
    expect(within(rowOf('Summer sale')).getByText('Expired')).toBeInTheDocument()
    expect(within(rowOf('Summer sale')).queryByText('Scheduled')).toBeNull()
    expect(within(rowOf('Free shipping')).getByText('Scheduled')).toBeInTheDocument()
    expect(within(rowOf('Free shipping')).queryByText('Expired')).toBeNull()
    expect(within(rowOf('Live today')).queryByText('Expired')).toBeNull()
    expect(within(rowOf('Live today')).queryByText('Scheduled')).toBeNull()
  })

  it('treats a promotion that ends today as running', () => {
    probe.state.promotions = [{ ...LIVE, end: '2026-10-10 23:59:59' }]
    renderList()
    expect(within(rowOf('Live today')).queryByText('Expired')).toBeNull()
  })

  it('names the switch of a row with its own key and takes its value from the promotion', () => {
    probe.state.promotions = [COUPON, FREE]
    renderList()
    expect(screen.getByRole('switch', { name: 'Enabled: Summer sale' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Enabled: Free shipping' })).toHaveAttribute('aria-checked', 'false')
    expect(probe.asked.has('PROMOTION_ENABLED_NAMED')).toBe(true)
    expect(probe.asked.has('MARKUP_ENABLED_NAMED')).toBe(false)
  })

  it('draws the same data as cards under 768px, with the switch', () => {
    probe.phone = true
    probe.state.promotions = [COUPON, FREE]
    renderList()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('list', { name: 'Promotions' })).toBeInTheDocument()
    const card = screen.getByRole('link', { name: 'Summer sale, View details' }).closest('li')
    expect(card.querySelector('.odc-bpl-type')).toHaveTextContent('Coupon · SUMMER')
    expect(screen.getByText('20 %')).toBeInTheDocument()
    expect(screen.getByText((_content, node) => node.classList?.contains('odc-bpl-sub') && node.textContent === 'Min. $20.00')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Summer sale' })).toBeInTheDocument()
  })
})

describe('BusinessPromotionList states (G4-16)', () => {
  it('shows a skeleton while it loads, and neither the empty text nor a table of rows', () => {
    probe.state = { promotions: [], loading: true, error: null }
    const { container } = renderList({ promotions: undefined })
    expect(screen.queryByText('No promotions yet')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('.odc-skeleton')).not.toBeNull()
    expect(screen.getByText('Loading promotions')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Promotions' })).toHaveAttribute('aria-busy', 'true')
  })

  it('says why it could not load, with Retry, and never looks empty', async () => {
    const user = userEvent.setup()
    probe.state = { promotions: [], loading: false, error: 'Network down' }
    renderList({ promotions: undefined })
    const notice = screen.getByRole('alert')
    expect(notice).toHaveTextContent("We couldn't load the promotions.")
    expect(notice).toHaveTextContent('Network down')
    expect(screen.queryByText('No promotions yet')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    await user.click(within(notice).getByRole('button', { name: 'Retry' }))
    expect(probe.spies.reload).toHaveBeenCalledTimes(1)
  })

  it('says it from a list of messages too', () => {
    probe.state = { promotions: [], loading: false, error: ['Unauthorized'] }
    renderList({ promotions: undefined })
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
  })

  it('says «No promotions yet» with «Add promotion» when the store has none, and opens a new one', async () => {
    const user = userEvent.setup()
    renderList()
    expect(screen.getByText('No promotions yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    // one above, one in the empty state
    const add = screen.getAllByRole('button', { name: 'Add promotion' })
    expect(add).toHaveLength(2)
    await user.click(add[1])
    expect(detailOf('New promotion')).toBeInTheDocument()
    expect(probe.spies.extend).toHaveBeenCalledWith(true)
  })
})

describe('BusinessPromotionList switch of a row (S-3)', () => {
  it('saves at once through the controller with inlineError and does not open the row', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Summer sale' }))
    await waitFor(() => expect(probe.spies.toggle).toHaveBeenCalledWith(false, 1, { inlineError: true }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enabled: Summer sale' })).toHaveAttribute('aria-checked', 'false'))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('goes back and says why when the save fails', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    probe.answers.toggle = { ok: false, error: 'Not allowed' }
    renderList()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Summer sale' }))
    expect(await screen.findByText('Not allowed')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enabled: Summer sale' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('goes back with its own text when the API gives no reason', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    probe.answers.toggle = { ok: false }
    renderList()
    await user.click(screen.getByRole('switch', { name: 'Enabled: Summer sale' }))
    expect(await screen.findByText("We couldn't change this promotion. Try again.")).toBeInTheDocument()
  })
})

describe('BusinessPromotionList detail (S-4, S-5, S-10)', () => {
  it('opens the detail with a click on the row and gives the form its record and the callbacks of the contract', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON, FREE]
    renderList()
    await user.click(openButton('Summer sale'))
    expect(detailOf('Summer sale')).toBeInTheDocument()
    expect(screen.getByTestId('general-form')).toBeInTheDocument()
    expect(probe.spies.extend).toHaveBeenCalledWith(true)
    expect(probe.formProps.promotion).toEqual(expect.objectContaining({ id: 1, name: 'Summer sale' }))
    expect(probe.formProps.business).toBe(BUSINESS)
    expect(probe.formProps.handleSuccessUpdate).toBe(probe.spies.success)
    for (const callback of ['onToggleEnabled', 'onCreated', 'onSaved', 'onClose']) expect(typeof probe.formProps[callback]).toBe('function')
    expect(rowOf('Summer sale')).toHaveAttribute('data-active') // beside the detail the list is cards; the open one is marked
  })

  it('beside an open detail the list is cards (no broken words), and closing brings the table back with the focus on the row', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON, FREE]
    renderList()
    expect(screen.getByRole('table')).toBeInTheDocument()
    await user.click(openButton('Summer sale'))
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('link', { name: 'Free shipping, View details' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    await waitFor(() => expect(rowOf('Summer sale')).toHaveFocus())
  })

  it('opens it from the keyboard too (Enter on the row)', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON, FREE]
    renderList()
    act(() => rowOf('Free shipping').focus())
    await user.keyboard('{Enter}')
    expect(detailOf('Free shipping')).toBeInTheDocument()
  })

  it('opens a new promotion empty, with no tabs', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(screen.getByRole('button', { name: 'Add promotion' }))
    expect(detailOf('New promotion')).toBeInTheDocument()
    expect(probe.formProps.promotion).toEqual({})
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByTestId('custom-fields')).toBeNull()
  })

  it('shows General and Custom fields tabs on a saved promotion, and the custom fields of that promotion', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(openButton('Summer sale'))
    const tabs = screen.getByRole('tablist', { name: 'Promotion sections' })
    expect(within(tabs).getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    await user.click(within(tabs).getByRole('tab', { name: 'Custom fields' }))
    expect(await screen.findByTestId('custom-fields')).toHaveTextContent('fields:7:1')
    expect(probe.fieldsProps).toMatchObject({ businessId: 7, offerId: 1 })
    expect(screen.queryByTestId('general-form')).toBeNull()
    await user.click(within(tabs).getByRole('tab', { name: 'General' }))
    expect(await screen.findByTestId('general-form')).toBeInTheDocument()
  })

  it('asks before changing tab when the form has unsaved work, and changes only when the guard lets go', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(openButton('Summer sale'))
    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    await user.click(screen.getByRole('tab', { name: 'Custom fields' }))
    expect(probe.guard).toBeTypeOf('function') // the guard took over: it asks, then calls proceed itself
    expect(screen.queryByTestId('custom-fields')).toBeNull()
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    act(() => probe.guard())
    expect(await screen.findByTestId('custom-fields')).toBeInTheDocument()
  })

  it('asks before opening another promotion when the form has unsaved work', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON, FREE]
    renderList()
    await user.click(openButton('Summer sale'))
    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    await user.click(openButton('Free shipping'))
    expect(detailOf('Summer sale')).toBeInTheDocument()
    expect(probe.guard).toBeTypeOf('function')
    act(() => probe.guard())
    expect(await screen.findByRole('heading', { level: 3, name: 'Free shipping' })).toBeInTheDocument()
  })

  it('starts on General when another promotion is opened', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON, FREE]
    renderList()
    await user.click(openButton('Summer sale'))
    await user.click(screen.getByRole('tab', { name: 'Custom fields' }))
    await user.click(openButton('Free shipping'))
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByTestId('general-form')).toHaveTextContent('form:Free shipping')
  })

  it('keeps the record of the detail in step with the list (a switch of the table reaches the form)', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(openButton('Summer sale'))
    expect(screen.getByTestId('general-form')).toHaveTextContent('form:Summer sale:true')
    await user.click(screen.getByRole('switch', { name: 'Enabled: Summer sale' }))
    await waitFor(() => expect(screen.getByTestId('general-form')).toHaveTextContent('form:Summer sale:false'))
  })

  it('gives the form a toggle that saves through the controller with inlineError and answers { ok, error }', async () => {
    probe.state.promotions = [COUPON]
    probe.answers.toggle = { ok: false, error: 'Nope' }
    const user = userEvent.setup()
    renderList()
    await user.click(openButton('Summer sale'))
    let result
    await act(async () => { result = await probe.formProps.onToggleEnabled(COUPON, false) })
    expect(probe.spies.toggle).toHaveBeenCalledWith(false, 1, { inlineError: true })
    expect(result).toEqual({ ok: false, error: 'Nope' })
    probe.answers.toggle = { ok: true, result: { id: 1, enabled: false } }
    await act(async () => { result = await probe.formProps.onToggleEnabled(COUPON, false) })
    expect(result).toEqual({ ok: true })
  })

  it('passes to the created record, still open (and with its tabs), when the form creates one', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(screen.getByRole('button', { name: 'Add promotion' }))
    expect(screen.queryByRole('tablist')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Create it' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Created one' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Promotion sections' })).toBeInTheDocument()
  })

  it('takes the saved record into the title, and closes when the form asks', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(openButton('Summer sale'))
    await user.click(screen.getByRole('button', { name: 'Save it' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Renamed' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close it' }))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(probe.spies.extend).toHaveBeenLastCalledWith(false)
  })

  it('closes with the X of the detail', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    await user.click(openButton('Summer sale'))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })
})

describe('BusinessPromotionList delete (S-6)', () => {
  const openDelete = async (user) => {
    await user.click(openButton('Summer sale'))
    await user.click(within(screen.getByRole('heading', { level: 3, name: 'Summer sale' }).closest('header')).getByRole('button', { name: 'Delete' }))
    return screen.getByRole('alertdialog')
  }

  it('confirms with the name and what it means for the customers, and starts on Cancel', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    renderList()
    const dialog = await openDelete(user)
    expect(within(dialog).getByText('Delete "Summer sale"?')).toBeInTheDocument()
    expect(within(dialog).getByText("Customers can no longer use it. This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(probe.spies.remove).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(detailOf('Summer sale')).toBeInTheDocument()
    expect(probe.spies.remove).not.toHaveBeenCalled()
  })

  it('stays in the confirmation and says why when the delete fails', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    probe.answers.remove = { ok: false, error: 'It is in use' }
    renderList()
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))
    await waitFor(() => expect(probe.spies.remove).toHaveBeenCalledWith(1, { inlineError: true }))
    expect(await within(screen.getByRole('alertdialog')).findByText('It is in use')).toBeInTheDocument()
    // the page behind a modal question is inert: ask for it hidden
    expect(screen.getByRole('heading', { level: 3, name: 'Summer sale', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Summer sale, View details', hidden: true })).toBeInTheDocument()
  })

  it('says it with its own text when the API gives no reason', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON]
    probe.answers.remove = { ok: false }
    renderList()
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))
    expect(await within(screen.getByRole('alertdialog')).findByText("We couldn't delete this promotion. Try again.")).toBeInTheDocument()
  })

  it('closes the confirmation and the detail when it works, and the promotion leaves the list', async () => {
    const user = userEvent.setup()
    probe.state.promotions = [COUPON, FREE]
    renderList()
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete promotion' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(probe.spies.remove).toHaveBeenCalledWith(1, { inlineError: true })
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.queryByRole('row', { name: /Summer sale/ })).toBeNull()
    expect(rowOf('Free shipping')).toBeInTheDocument()
    expect(probe.spies.extend).toHaveBeenLastCalledWith(false)
  })
})

describe('BusinessPromotionList thumbnail (A-1)', () => {
  it('shows the image of the promotion, with no alt (the name is beside it), and the placeholder when there is none', () => {
    probe.state.promotions = [COUPON, FREE]
    renderList()
    const withImage = rowOf('Summer sale').querySelector('img')
    expect(withImage).toHaveAttribute('src', 'https://img.test/summer.png')
    expect(withImage).toHaveAttribute('alt', '')
    expect(rowOf('Free shipping').querySelector('img')).toHaveAttribute('src', 'dummy-promotion.png')
  })

  it('falls to the placeholder when the image fails to load', () => {
    probe.state.promotions = [COUPON]
    renderList()
    const image = rowOf('Summer sale').querySelector('img')
    fireEvent.error(image)
    expect(rowOf('Summer sale').querySelector('img')).toHaveAttribute('src', 'dummy-promotion.png')
  })

  it('tries the new image when the promotion changes its image after a failure', () => {
    const props = { promotions: [COUPON], onOpen: vi.fn(), onToggleEnabled: vi.fn() }
    const { rerender } = renderWithProviders(<PromotionsTable {...props} />, { theme: { images: { dummies: { promotionDummy: 'dummy-promotion.png' } } } })
    fireEvent.error(rowOf('Summer sale').querySelector('img'))
    expect(rowOf('Summer sale').querySelector('img')).toHaveAttribute('src', 'dummy-promotion.png')
    rerender(<PromotionsTable {...props} promotions={[{ ...COUPON, image: 'https://img.test/other.png' }]} />)
    expect(rowOf('Summer sale').querySelector('img')).toHaveAttribute('src', 'https://img.test/other.png')
  })
})
