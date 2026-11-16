/* eslint-disable import/first */
// redesign reviews FD2 (D6, D7, D9; RV-03, RV-10): the CSV dialog of /intelligence/reviews. The Product wrappers (Dialog, DateRangePopover,
// InlineNotice, FilterPopover) and K/PartyPicker are the real ones; the store picker is a stand-in that chooses a fixed store (its own
// spec is StorePicker.test.jsx); the driver list is the SDK chain of `main`, recorded here; the network is a stubbed `fetch`.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const api = vi.hoisted(() => ({
  calls: [],
  dateCalls: [],
  result: [],
  fail: false,
  root: 'https://api.test/v400/en/dev'
}))

vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {} }],
  useUtils: () => [{ parseDate: (day, options) => { api.dateCalls.push({ day, options }); return `fmt(${day})` } }],
  useApi: () => [{
    root: api.root,
    users: () => {
      const call = {}
      api.calls.push(call)
      const chain = {
        asDashboard: () => chain,
        select: (fields) => { call.select = fields; return chain },
        where: (where) => { call.where = where; return chain },
        get: async (options) => {
          call.get = options
          if (api.fail) throw new Error('network')
          return { content: { result: api.result } }
        }
      }
      return chain
    }
  }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => false }))
vi.mock('../../AnalyticsKit/StorePicker', () => ({
  StorePicker: ({ business, includeInactive, allLabel }) => (
    <div role='group' aria-label='Store stand-in' data-include-inactive={String(Boolean(includeInactive))} data-all-label={allLabel}>
      <span data-testid='store'>{business.selected ? business.selected.name : allLabel}</span>
      <button type='button' onClick={() => business.select({ id: 5, name: 'Alpha Pizza', external_id: 'x' })}>Pick Alpha</button>
      <button type='button' onClick={() => business.select(null)}>Pick all stores</button>
    </div>
  )
}))

import { periodOf } from '../../../../../../utils/businessReports'
import { defaultCsvRange } from '../reviewsData'
import { ReviewsExport } from '../ReviewsExport'

class FakeResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

const fetchMock = vi.fn()
let clicked
let clickSpy

const Harness = ({ tab = 'business', startOpen = true, onChange }) => {
  const [open, setOpen] = useState(startOpen)
  return (
    <>
      <button type='button' onClick={() => setOpen(true)}>Reopen export</button>
      <ReviewsExport tab={tab} open={open} onOpenChange={(next) => { onChange?.(next); setOpen(next) }} />
    </>
  )
}

const dialog = () => screen.getByRole('dialog', { name: 'Download reviews CSV' })
const requestOf = (index = 0) => {
  const url = new URL(fetchMock.mock.calls[index][0])
  return {
    url,
    where: JSON.parse(url.searchParams.get('where')),
    options: fetchMock.mock.calls[index][1]
  }
}
const download = async (user) => {
  await user.click(within(dialog()).getByRole('button', { name: 'Download' }))
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(['id,comment']) })
  clicked = []
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    clicked.push({ download: this.download })
  })
  URL.createObjectURL = vi.fn(() => 'blob:csv')
  URL.revokeObjectURL = vi.fn()
  api.calls = []
  api.dateCalls = []
  api.result = [{ id: 11, name: 'Ana', lastname: 'Ruiz' }, { id: 12, name: 'Luis', lastname: '' }, { id: 13, name: '', lastname: '' }]
  api.fail = false
})

afterEach(() => {
  cleanup()
  clickSpy.mockRestore()
  vi.unstubAllGlobals()
  document.getElementById('app-modals')?.remove()
})

describe('ReviewsExport · the dialog', () => {
  it('is a small Product dialog called «Download reviews CSV», closed when `open` is false', () => {
    const { rerender } = render(<ReviewsExport tab='business' open={false} onOpenChange={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<ReviewsExport tab='business' open onOpenChange={() => {}} />)
    const box = dialog()
    expect(box).toHaveAttribute('data-size', 'sm')
    expect(within(box).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Download' })).toHaveAttribute('data-variant', 'primary')
  })

  // redesign reviews R1 (Q1-10): the Business and Driver pills say what they are, so the field has no label of its own above them (it
  // was said twice: «Business» and then «Business · All businesses»); only «Period», which is a plain trigger, keeps its label
  const visibleLabels = (box) => [...box.querySelectorAll('.odc-rv-field-label')].map(label => label.textContent)

  it('the business tab has the business pill (every business, inactive ones included) and Period, and no Driver', () => {
    render(<Harness />)
    const box = dialog()
    const store = within(box).getByRole('group', { name: 'Store stand-in' })
    expect(store).toHaveAttribute('data-include-inactive', 'true')
    expect(store).toHaveAttribute('data-all-label', 'All businesses')
    expect(visibleLabels(box)).toEqual(['Period'])
    expect(within(box).queryByText('Business')).toBeNull()
    expect(within(box).queryByText('Driver')).toBeNull()
  })

  it('the drivers tab has the driver pill («All drivers») and Period, and no Business', () => {
    render(<Harness tab='drivers' />)
    const box = dialog()
    expect(within(box).getByRole('button', { name: /Driver/ })).toHaveAccessibleName('Driver All drivers')
    expect(visibleLabels(box)).toEqual(['Period'])
    // the word «Driver» is in the pill and nowhere else
    expect(within(box).queryAllByText('Driver').filter(node => !node.closest('button'))).toEqual([])
    expect(within(box).queryByRole('group', { name: 'Store stand-in' })).toBeNull()
  })

  it('Cancel closes without asking for anything', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(onChange).toHaveBeenCalledWith(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('ReviewsExport · business CSV', () => {
  it('by default asks for the last 30 days of every business and names the file with them', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const { from, to } = defaultCsvRange()
    expect(within(dialog()).getByRole('button', { name: `fmt(${from}) – fmt(${to})` })).toBeInTheDocument()
    await download(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const { url, where, options } = requestOf()
    expect(`${url.origin}${url.pathname}`).toBe(`${api.root}/business/business_reviews_delivery.csv`)
    expect(url.searchParams.has('business_id')).toBe(false)
    expect(where).toEqual([
      { attribute: 'created_at', value: { condition: '>=', value: `${from} 00:00:00` } },
      { attribute: 'created_at', value: { condition: '<=', value: `${to} 23:59:59` } }
    ])
    expect(options).toEqual({ method: 'GET', headers: { Authorization: 'Bearer test-token' } })
    await waitFor(() => expect(clicked).toEqual([{ download: `business_reviews_delivery_${from}_${to}.csv` }]))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false))
  })

  it('with a business chosen it adds business_id; «All businesses» takes it away again', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Pick Alpha' }))
    expect(screen.getByTestId('store')).toHaveTextContent('Alpha Pizza')
    await download(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(requestOf(0).url.searchParams.get('business_id')).toBe('5')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Download reviews CSV' })).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Reopen export' }))
    await user.click(await screen.findByRole('button', { name: 'Pick all stores' }))
    await download(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(requestOf(1).url.searchParams.has('business_id')).toBe(false)
  })

  it('a preset changes the dates of the request and of the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const week = periodOf('last_7_days')
    await user.click(within(dialog()).getByRole('button', { name: /fmt\(/ }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    // the presets are Today, Yesterday, Last 7 days and Last 30 days; the last 30 days is the one that is on
    expect(within(popup).getAllByRole('button', { pressed: undefined }).map(button => button.textContent).slice(0, 4)).toEqual(['Today', 'Yesterday', 'Last 7 days', 'Last 30 days'])
    expect(within(popup).getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true')
    // the panel holds no draft (no `data-hold`): a preset applies at once and the popover closes with it
    expect(popup.querySelector('.odc-dr-foot[data-hold]')).toBeNull()
    await user.click(within(popup).getByRole('button', { name: 'Last 7 days' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
    expect(within(dialog()).getByRole('button', { name: `fmt(${week.from}) – fmt(${week.to})` })).toBeInTheDocument()
    await download(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const { where } = requestOf()
    expect(where[0].value.value).toBe(`${week.from} 00:00:00`)
    expect(where[1].value.value).toBe(`${week.to} 23:59:59`)
  })

  // redesign reviews R1 (Q1-4): the calendar closes as soon as the range is whole, so «Download» is not left under the popover
  describe('a custom range (Q1-4)', () => {
    const month = () => defaultCsvRange().from.slice(0, 7)
    const openCalendar = async (user) => {
      const trigger = within(dialog()).getByRole('button', { name: /fmt\(/ })
      await user.click(trigger)
      const popup = await screen.findByRole('dialog', { name: 'Select a date' })
      return { trigger, popup }
    }
    const day = (popup, number) => popup.querySelector(`[data-day="${month()}-${number}"]`)

    it('day then day applies the range, closes the calendar, gives the focus back to the trigger and leaves «Download» reachable', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      const { trigger, popup } = await openCalendar(user)
      await user.click(day(popup, '10'))
      // half way: still open, nothing applied
      expect(screen.getByRole('dialog', { name: 'Select a date' })).toBeInTheDocument()
      await user.click(day(popup, '12'))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
      expect(document.querySelector('.odc-dr-presets')).toBeNull()
      expect(trigger).toHaveAccessibleName(`fmt(${month()}-10) – fmt(${month()}-12)`)
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await waitFor(() => expect(trigger).toHaveFocus())
      // «Download» is the next click, with no «Done», Escape or press outside in between
      await download(user)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const { where } = requestOf()
      expect(where[0].value.value).toBe(`${month()}-10 00:00:00`)
      expect(where[1].value.value).toBe(`${month()}-12 23:59:59`)
    })

    it('a half range does not close the calendar and is not applied', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      const { from, to } = defaultCsvRange()
      const { trigger, popup } = await openCalendar(user)
      await user.click(day(popup, '10'))
      expect(screen.getByRole('dialog', { name: 'Select a date' })).toBeInTheDocument()
      expect(trigger).toHaveAccessibleName(`fmt(${from}) – fmt(${to})`)
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
      await download(user)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const { where } = requestOf()
      expect(where[0].value.value).toBe(`${from} 00:00:00`)
      expect(where[1].value.value).toBe(`${to} 23:59:59`)
    })

    // redesign (row 73): one day picked and Escape left the draft at From = that day, To empty; reopening showed that
    // half range while the applied one had not changed
    it('one day picked and Escape: reopening shows the applied range again, not the half range', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      const { from, to } = defaultCsvRange()
      const { trigger, popup } = await openCalendar(user)
      await user.click(day(popup, '10'))
      expect(within(popup).getByLabelText('From')).toHaveValue(`${month()}-10`)
      expect(within(popup).getByLabelText('To')).toHaveValue('')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
      await user.click(trigger)
      const reopened = await screen.findByRole('dialog', { name: 'Select a date' })
      expect(within(reopened).getByLabelText('From')).toHaveValue(from)
      expect(within(reopened).getByLabelText('To')).toHaveValue(to)
      expect(trigger).toHaveAccessibleName(`fmt(${from}) – fmt(${to})`)
    })

    it('after an applied range, reopening shows that range', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      const { trigger, popup } = await openCalendar(user)
      await user.click(day(popup, '10'))
      await user.click(day(popup, '12'))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
      await user.click(trigger)
      const reopened = await screen.findByRole('dialog', { name: 'Select a date' })
      expect(within(reopened).getByLabelText('From')).toHaveValue(`${month()}-10`)
      expect(within(reopened).getByLabelText('To')).toHaveValue(`${month()}-12`)
    })

    it('a range that is whole by typing in the fields closes it too', async () => {
      const user = userEvent.setup()
      render(<Harness />)
      const { trigger } = await openCalendar(user)
      const popup = screen.getByRole('dialog', { name: 'Select a date' })
      const target = `${month()}-05`
      const input = within(popup).getByLabelText('From')
      await user.clear(input)
      await user.type(input, target)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
      expect(trigger).toHaveAccessibleName(`fmt(${target}) – fmt(${defaultCsvRange().to})`)
    })
  })

  it('Today and Yesterday are one day: the file and the trigger say one date', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const yesterday = periodOf('yesterday')
    await user.click(within(dialog()).getByRole('button', { name: /fmt\(/ }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(within(popup).getByRole('button', { name: 'Yesterday' }))
    expect(within(dialog()).getByRole('button', { name: `fmt(${yesterday.from})` })).toBeInTheDocument()
    await download(user)
    await waitFor(() => expect(clicked).toEqual([{ download: `business_reviews_delivery_${yesterday.from}_${yesterday.to}.csv` }]))
  })

  it('the dates are written by parseDate of the project, as days of the local calendar (never an ISO text of its own)', () => {
    render(<Harness />)
    const { from, to } = defaultCsvRange()
    const trigger = within(dialog()).getByRole('button', { name: /fmt\(/ })
    expect(trigger.textContent).toBe(`fmt(${from}) – fmt(${to})`)
    expect(api.dateCalls).toEqual(expect.arrayContaining([
      { day: from, options: { utc: false, dateOnly: true, inputFormat: 'YYYY-MM-DD' } },
      { day: to, options: { utc: false, dateOnly: true, inputFormat: 'YYYY-MM-DD' } }
    ]))
  })
})

describe('ReviewsExport · drivers CSV', () => {
  it('asks for the driver reviews (type 1) of every driver, with the dates, and names the file driver_reviews_…', async () => {
    const user = userEvent.setup()
    render(<Harness tab='drivers' />)
    const { from, to } = defaultCsvRange()
    await download(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const { url, where } = requestOf()
    expect(`${url.origin}${url.pathname}`).toBe(`${api.root}/users/user_reviews.csv`)
    expect(url.searchParams.has('user_id')).toBe(false)
    expect(where).toEqual([
      { attribute: 'type', value: 1 },
      { attribute: 'created_at', value: { condition: '>=', value: `${from} 00:00:00` } },
      { attribute: 'created_at', value: { condition: '<=', value: `${to} 23:59:59` } }
    ])
    await waitFor(() => expect(clicked).toEqual([{ download: `driver_reviews_${from}_${to}.csv` }]))
  })

  it('the list of drivers is not asked for until the pill is opened (RV-10), and is the list of main', async () => {
    const user = userEvent.setup()
    render(<Harness tab='drivers' />)
    expect(api.calls).toHaveLength(0)
    await user.click(within(dialog()).getByRole('button', { name: /Driver/ }))
    const popup = await screen.findByRole('dialog', { name: 'Driver' })
    await waitFor(() => expect(api.calls).toHaveLength(1))
    expect(api.calls[0].select).toEqual(['id', 'name', 'lastname'])
    expect(api.calls[0].where).toEqual({ conditions: [{ attribute: 'level', value: 4 }], conector: 'AND' })
    expect(api.calls[0].get).toEqual({ query: { page: 1, page_size: 50 } })
    // «All drivers» first, then «name lastname», or «#id» when it has no name
    await waitFor(() => expect(within(popup).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['All drivers', 'Ana Ruiz', 'Luis', '#13']))
    expect(within(popup).getByRole('radio', { name: 'All drivers' })).toHaveAttribute('aria-checked', 'true')
  })

  it('choosing a driver puts user_id in the request; choosing «All drivers» takes it out', async () => {
    const user = userEvent.setup()
    render(<Harness tab='drivers' />)
    await user.click(within(dialog()).getByRole('button', { name: /Driver/ }))
    let popup = await screen.findByRole('dialog', { name: 'Driver' })
    await user.click(await within(popup).findByRole('radio', { name: 'Ana Ruiz' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver' })).toBeNull())
    expect(within(dialog()).getByRole('button', { name: /Driver/ })).toHaveAccessibleName('Driver Ana Ruiz')
    await download(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(requestOf(0).url.searchParams.get('user_id')).toBe('11')

    await user.click(screen.getByRole('button', { name: 'Reopen export' }))
    await user.click(within(dialog()).getByRole('button', { name: /Driver/ }))
    popup = await screen.findByRole('dialog', { name: 'Driver' })
    await user.click(await within(popup).findByRole('radio', { name: 'All drivers' }))
    await download(user)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(requestOf(1).url.searchParams.has('user_id')).toBe(false)
  })

  // redesign reviews R1 (Q1-1): the search is sent encoded, as ReviewProductList does. A bare `%Ca…` is read by the server as a hex escape
  // and the whole `where` (level 4 included) is dropped, so «Carl» listed users of any level.
  it('typing in the picker searches on the server with the name condition of main, the text encoded', async () => {
    const user = userEvent.setup()
    render(<Harness tab='drivers' />)
    await user.click(within(dialog()).getByRole('button', { name: /Driver/ }))
    const popup = await screen.findByRole('dialog', { name: 'Driver' })
    await waitFor(() => expect(api.calls).toHaveLength(1))
    await user.type(within(popup).getByRole('searchbox'), 'ana')
    await waitFor(() => expect(api.calls).toHaveLength(2), { timeout: 2000 })
    expect(api.calls[1].where).toEqual({
      conditions: [
        { attribute: 'level', value: 4 },
        { attribute: 'name', value: { condition: 'ilike', value: '%25ana%25' } }
      ],
      conector: 'AND'
    })
  })

  it('a term that starts with two hex digits («Carl») goes out as %25Carl%25, never as a bare %Carl%', async () => {
    const user = userEvent.setup()
    render(<Harness tab='drivers' />)
    await user.click(within(dialog()).getByRole('button', { name: /Driver/ }))
    const popup = await screen.findByRole('dialog', { name: 'Driver' })
    await waitFor(() => expect(api.calls).toHaveLength(1))
    await user.type(within(popup).getByRole('searchbox'), 'Carl')
    await waitFor(() => expect(api.calls.length).toBeGreaterThan(1), { timeout: 2000 })
    const name = api.calls.at(-1).where.conditions.find(condition => condition.attribute === 'name')
    expect(name.value).toEqual({ condition: 'ilike', value: '%25Carl%25' })
    expect(JSON.stringify(api.calls.map(call => call.where))).not.toMatch(/"%Ca/)
  })

  it('a list that fails says so and offers «Try again», which asks again', async () => {
    const user = userEvent.setup()
    api.fail = true
    render(<Harness tab='drivers' />)
    await user.click(within(dialog()).getByRole('button', { name: /Driver/ }))
    const popup = await screen.findByRole('dialog', { name: 'Driver' })
    expect(await within(popup).findByRole('alert')).toBeInTheDocument()
    api.fail = false
    await user.click(within(popup).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(api.calls).toHaveLength(2))
    expect(await within(popup).findByRole('radio', { name: 'Ana Ruiz' })).toBeInTheDocument()
  })
})

describe('ReviewsExport · errors, state and Escape', () => {
  it('an answer of the API with an error shows inside the dialog, which stays open', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ result: ['No access to these reviews'] }) })
    render(<Harness onChange={onChange} />)
    await download(user)
    const notice = await within(dialog()).findByRole('status')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(notice).toHaveTextContent('No access to these reviews')
    expect(onChange).not.toHaveBeenCalled()
    expect(clicked).toEqual([])
  })

  it('the error goes away when a field changes, and when the dialog is opened again', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ result: ['Boom'] }) })
    render(<Harness />)
    await download(user)
    await within(dialog()).findByText('Boom')
    await user.click(screen.getByRole('button', { name: 'Pick Alpha' }))
    expect(within(dialog()).queryByText('Boom')).toBeNull()

    await download(user)
    await within(dialog()).findByText('Boom')
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Reopen export' }))
    expect(within(dialog()).queryByText('Boom')).toBeNull()
  })

  it('Download is busy while the file comes and is not asked twice', async () => {
    const user = userEvent.setup()
    let finish
    fetchMock.mockReturnValue(new Promise(resolve => { finish = () => resolve({ ok: true, blob: async () => new Blob(['x']) }) }))
    render(<Harness />)
    const button = within(dialog()).getByRole('button', { name: 'Download' })
    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'))
    await user.click(button)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(clicked).toHaveLength(1))
  })

  it('what was chosen is kept when the dialog is closed and opened again', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Pick Alpha' }))
    await user.click(within(dialog()).getByRole('button', { name: /fmt\(/ }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(within(popup).getByRole('button', { name: 'Last 7 days' }))
    const week = periodOf('last_7_days')
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Reopen export' }))
    expect(screen.getByTestId('store')).toHaveTextContent('Alpha Pizza')
    expect(within(dialog()).getByRole('button', { name: `fmt(${week.from}) – fmt(${week.to})` })).toBeInTheDocument()
  })

  it('Escape closes the layer that is on top first: the driver pill, then the dialog', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness tab='drivers' onChange={onChange} />)
    await user.click(within(dialog()).getByRole('button', { name: /Driver/ }))
    await screen.findByRole('dialog', { name: 'Driver' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver' })).toBeNull())
    expect(onChange).not.toHaveBeenCalled()
    expect(dialog()).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false))
  })

  it('Escape closes the calendar first, then the dialog', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(within(dialog()).getByRole('button', { name: /fmt\(/ }))
    await screen.findByRole('dialog', { name: 'Select a date' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).toBeNull())
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false))
  })
})

describe('the sources of the CSV dialog', () => {
  const base = path.join(__dirname, '..')
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('have no literal color, size, weight, duration or z-index, and use none of the old pieces', () => {
    for (const name of ['ReviewsExport.jsx', 'DriverPicker.jsx', 'reviews-page.css']) {
      const source = readFileSync(path.join(base, name), 'utf8')
      expect(scanSource(source, name), name).toEqual([])
    }
    for (const name of ['ReviewsExport.jsx', 'DriverPicker.jsx']) {
      const source = readFileSync(path.join(base, name), 'utf8')
      expect(source, name).not.toMatch(/from '\.\.\/\.\.\/(Shared|Stores|BusinessIntelligence)\/?(UI|BusinessSelectHeader|AnalyticsCalendar)?'/)
      expect(source, name).not.toMatch(/styled-components|ReviewsListing\/styles/)
    }
  })

  it('the CSS has no physical direction property and only its own odc-rv- classes', () => {
    const css = strip(readFileSync(path.join(base, 'reviews-page.css'), 'utf8'))
    expect(css.match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
    const own = (css.match(/\.[a-z][\w-]*/g) ?? []).filter(name => !name.startsWith('.odc-rv-') && !/^\.(odc-(split|pagehead|btn|dr|root)|od-learn|od-ui|learn-drop-down)/.test(name))
    expect(own).toEqual([])
  })
})
