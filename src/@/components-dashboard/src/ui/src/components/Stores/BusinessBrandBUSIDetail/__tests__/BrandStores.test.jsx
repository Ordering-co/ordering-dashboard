/* eslint-disable import/first */
// redesign SB-B4 (; decision 4; G5-45, M-SB2, M-SB7): the Stores tab of a brand on Product.
// Covered: a row per store with a checkbox named after the store; a store that belongs to ANOTHER brand says «In <name>» (the name comes
// from `brandListState.brands`; when that brand is not in the loaded list, «In brand #id»); the scope text counts the stores of the
// page; a click saves one store and a store that is saving ignores a second click; a failed save leaves the box as it was and says why
// on that store (one role=alert per store); «Select none» reaches the controller as `(false, brandId)` and a store of another brand is
// never saved; a block with failures is summed up; a failed load is an error with Retry, not an empty list; the foot keeps page AND size.
// redesign D-85 (owner, 2026-10-19): taking stores that belong to ANOTHER brand asks first («Move _store_ from _from_ to _to_?»), from
// «Select all» and from the tick of one such store; stores without a brand, «Select none» and unticking an own store stay immediate.
// The controller is a stand-in that follows the SB-B1 contract (`{ ok, error }`, `failures`, `pending`, in series); the real one has
// its own tests.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ spies: {}, failures: {}, hold: null, businesses: [], pagination: null, listOverrides: {}, wiring: null }))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{ optimizeImage: (url, options) => `${url}?${options}` }],
    BusinessBrandBUSIDetail: ({ UIComponent, ...props }) => {
      probe.wiring = { propsToFetch: props.propsToFetch, isSearchByName: props.isSearchByName }
      const [list, setList] = ReactModule.useState(() => ({
        loading: false,
        businesses: probe.businesses,
        pagination: probe.pagination,
        error: null,
        failures: {},
        pending: [],
        ...probe.listOverrides
      }))
      const [searchValue, setSearchValue] = ReactModule.useState(null)
      const latest = ReactModule.useRef(list)
      latest.current = list

      const save = async (id, franchiseId) => {
        setList(prev => {
          const { [id]: _gone, ...failures } = prev.failures
          return { ...prev, failures, pending: [...prev.pending, id] }
        })
        probe.spies.save?.(id, franchiseId)
        if (probe.hold) await probe.hold
        const failed = id in probe.failures
        const failure = probe.failures[id]
        setList(prev => ({
          ...prev,
          pending: prev.pending.filter(item => item !== id),
          failures: failed ? { ...prev.failures, [id]: failure } : prev.failures,
          businesses: failed
            ? prev.businesses
            : prev.businesses.map(business => (business.id === id ? { ...business, franchise_id: franchiseId } : business))
        }))
        return failed ? { ok: false, error: [failure] } : { ok: true }
      }

      const handlers = {
        handleChangeCheckBox: (event, businessId, brandId) => {
          probe.spies.check?.(event.target.checked, businessId, brandId)
          return save(businessId, event.target.checked ? brandId : null)
        },
        handleSelectAllBusinesses: async (isAll, brandId) => {
          probe.spies.selectAll?.(isAll, brandId)
          const targets = latest.current.businesses.filter(business => (isAll ? business.franchise_id !== brandId : business.franchise_id === brandId))
          const failed = []
          for (const business of targets) {
            const result = await save(business.id, isAll ? brandId : null)
            if (!result.ok) failed.push({ id: business.id, error: result.error })
          }
          return { ok: failed.length === 0, failed }
        },
        handleChangeBusinessPage: page => probe.spies.page?.(page),
        handleChangeBusinessPageSize: size => probe.spies.size?.(size),
        handleRetry: () => probe.spies.retry?.(),
        onSearch: value => {
          probe.spies.search?.(value)
          setSearchValue(value)
        }
      }
      return ReactModule.createElement(UIComponent, { ...props, searchValue, businessList: list, ...handlers })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)

import { BusinessBrandBUSIDetail } from '../index'

const BRAND = { id: 1, name: 'Burger Palace' }
const BRANDS = [BRAND, { id: 34, name: 'Vips' }]
const STORES = [
  { id: 11, name: 'Fast Bite', logo: 'fast.png', franchise_id: 1 },
  { id: 12, name: 'KCF', logo: null, franchise_id: 34 },
  { id: 13, name: "Dono's Pizza", logo: null, franchise_id: null },
  { id: 14, name: 'Subway', logo: null, franchise_id: null }
]

const Harness = (props) => (
  <BusinessBrandBUSIDetail brand={BRAND} brandListState={{ brands: BRANDS }} {...props} />
)

// a text split by a `.odc-figure` node still reads as one sentence
const text = (value) => (_content, node) => node?.tagName === 'P' && node.textContent === value
const box = (name) => screen.getByRole('checkbox', { name })
const MOVE_BODY = "They leave their current brand, and the dashboard can't tell later which brand each one came from."
const MOVE_BODY_ONE = "It leaves its current brand, and the dashboard can't tell later which brand it came from." // one store: singular (live review)
// the one question of D-85, and the answer given to it
const moveDialog = () => screen.findByRole('alertdialog')
const answerMove = async (user, name) => {
  const dialog = await moveDialog()
  await user.click(within(dialog).getByRole('button', { name }))
}

beforeEach(() => {
  probe.spies = {}
  probe.failures = {}
  probe.hold = null
  probe.businesses = STORES
  probe.pagination = { current_page: 1, total_pages: 1, page_size: 10, total: 4 }
  probe.listOverrides = {}
})

describe('BrandStores · the rows', () => {
  it('draws a checkbox per store, named after the store, checked only for this brand', () => {
    render(<Harness />)
    expect(box('Fast Bite').getAttribute('aria-checked')).toBe('true')
    expect(box('KCF').getAttribute('aria-checked')).toBe('false')
    expect(box("Dono's Pizza").getAttribute('aria-checked')).toBe('false')
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  })

  it('says «In Vips» for a store of another brand, and only for that one', () => {
    render(<Harness />)
    expect(screen.getAllByText(text('In Vips'))).toHaveLength(1)
    const row = box('KCF').closest('li')
    expect(within(row).getByText(text('In Vips'))).toBeTruthy()
    expect(within(box('Fast Bite').closest('li')).queryByText(/^In /)).toBeNull()
    expect(within(box('Subway').closest('li')).queryByText(/^In /)).toBeNull()
  })

  it('says «In brand #99» when that brand is not in the loaded list (auditor 6)', () => {
    probe.businesses = [{ id: 15, name: 'Mystery', franchise_id: 99 }]
    render(<Harness />)
    expect(screen.getByText(text('In brand #99'))).toBeTruthy()
  })

  it('counts the stores of the page in the scope text, in the singular too', () => {
    const { unmount } = render(<Harness />)
    expect(screen.getByText(text('Applies to the 4 stores on this page'))).toBeTruthy()
    unmount()
    probe.businesses = [STORES[0]]
    render(<Harness />)
    expect(screen.getByText(text('Applies to the 1 store on this page'))).toBeTruthy()
  })

  it('says there is no selected brand and draws no list without one', () => {
    render(<Harness brand={null} />)
    expect(screen.getByText('There is no selected brand')).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('BrandStores · one store', () => {
  it('saves the store with the checked value and the brand, and the box follows the answer', async () => {
    const user = userEvent.setup()
    const check = vi.fn()
    probe.spies.check = check
    render(<Harness />)
    await user.click(box("Dono's Pizza"))
    expect(check).toHaveBeenCalledWith(true, 13, 1)
    await waitFor(() => expect(box("Dono's Pizza").getAttribute('aria-checked')).toBe('true'))
    await user.click(box('Fast Bite'))
    expect(check).toHaveBeenLastCalledWith(false, 11, 1)
    await waitFor(() => expect(box('Fast Bite').getAttribute('aria-checked')).toBe('false'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('while a store saves its box is busy and a second click does not save again', async () => {
    const user = userEvent.setup()
    const check = vi.fn()
    probe.spies.check = check
    let release
    probe.hold = new Promise(resolve => { release = resolve })
    render(<Harness />)
    await user.click(box('Subway'))
    await waitFor(() => expect(box('Subway').getAttribute('aria-busy')).toBe('true'))
    await user.click(box('Subway'))
    expect(check).toHaveBeenCalledTimes(1)
    expect(box('KCF').getAttribute('aria-busy')).toBeNull()
    await act(async () => { release() })
    await waitFor(() => expect(box('Subway').getAttribute('aria-busy')).toBeNull())
  })

  it('a failed save leaves the box as it was and says why on that store, once', async () => {
    const user = userEvent.setup()
    probe.failures = { 14: 'Not allowed' }
    render(<Harness />)
    await user.click(box('Subway'))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Not allowed')
    expect(within(box('Subway').closest('li')).getByRole('alert')).toBe(alert)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(box('Subway').getAttribute('aria-checked')).toBe('false')
    expect(box('Subway').getAttribute('aria-busy')).toBeNull()
    // trying again clears the message while it saves
    probe.failures = {}
    await user.click(box('Subway'))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await waitFor(() => expect(box('Subway').getAttribute('aria-checked')).toBe('true'))
  })

  it('a failure without text falls back to a sentence of its own', async () => {
    const user = userEvent.setup()
    probe.failures = { 14: '' }
    render(<Harness />)
    await user.click(box('Subway'))
    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't update this store. Try again.")
  })
})

describe('BrandStores · Select all / Select none', () => {
  it('«Select all» and «Select none» reach the controller with the brand', async () => {
    const user = userEvent.setup()
    const selectAll = vi.fn()
    probe.spies.selectAll = selectAll
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    // redesign D-85: the Vips store would move, so «Select all» asks first
    await answerMove(user, 'Move store')
    expect(selectAll).toHaveBeenLastCalledWith(true, 1)
    await waitFor(() => expect(screen.getAllByRole('checkbox').every(item => item.getAttribute('aria-checked') === 'true')).toBe(true))
    await user.click(screen.getByRole('button', { name: 'Select none' }))
    expect(selectAll).toHaveBeenLastCalledWith(false, 1)
  })

  it('«Select none» does not save the store of another brand (M-SB2)', async () => {
    const user = userEvent.setup()
    const save = vi.fn()
    probe.spies.save = save
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Select none' }))
    await waitFor(() => expect(box('Fast Bite').getAttribute('aria-checked')).toBe('false'))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(11, null)
    expect(box('KCF').getAttribute('aria-checked')).toBe('false')
    expect(within(box('KCF').closest('li')).getByText(text('In Vips'))).toBeTruthy()
    // redesign D-85: freeing the stores of this brand never asks, even with a store of another brand on the page
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a block with failures keeps those boxes, says why on each store and sums them up', async () => {
    const user = userEvent.setup()
    probe.failures = { 13: 'No permission', 14: 'No permission' }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    await answerMove(user, 'Move store') // redesign D-85
    const notice = await screen.findByText("2 stores couldn't be changed")
    expect(notice.closest('[data-tone]').getAttribute('data-tone')).toBe('danger')
    // redesign SB-R1 (review R1-03): several failures are announced once, by the summary; each store still says why, not as an alert
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert').textContent).toContain("2 stores couldn't be changed")
    expect(within(box("Dono's Pizza").closest('li')).getByText('No permission')).toBeTruthy()
    expect(box("Dono's Pizza").getAttribute('aria-checked')).toBe('false')
    expect(box('Subway').getAttribute('aria-checked')).toBe('false')
    // the store that could be changed was changed
    expect(box('KCF').getAttribute('aria-checked')).toBe('true')
  })

  it('says «1 store» in the singular when one store could not be changed', async () => {
    const user = userEvent.setup()
    probe.failures = { 14: 'No permission' }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    await answerMove(user, 'Move store') // redesign D-85
    expect(await screen.findByText("1 store couldn't be changed")).toBeTruthy()
  })

  it('has no actions to run on an empty page', () => {
    probe.businesses = []
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Select all' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Select none' }).disabled).toBe(true)
  })
})

// redesign D-85 (owner, 2026-10-19): the move of a store from ANOTHER brand is confirmed; nothing else is.
describe('BrandStores · taking stores from another brand (D-85)', () => {
  const selectAllButton = () => screen.getByRole('button', { name: 'Select all' })

  it('«Select all» with one store of another brand asks first, naming the store, both brands and the consequence', async () => {
    const user = userEvent.setup()
    const selectAll = vi.fn()
    const save = vi.fn()
    probe.spies = { selectAll, save }
    render(<Harness />)
    await user.click(selectAllButton())
    const dialog = await moveDialog()
    expect(within(dialog).getByText('Move KCF from Vips to Burger Palace?')).toBeTruthy()
    expect(within(dialog).getByText(MOVE_BODY_ONE)).toBeTruthy()
    const confirm = within(dialog).getByRole('button', { name: 'Move store' })
    expect(confirm.getAttribute('data-variant')).toBe('danger')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    // nothing is written while the question is open
    expect(selectAll).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('Cancel writes nothing and ticks nothing', async () => {
    const user = userEvent.setup()
    const selectAll = vi.fn()
    const save = vi.fn()
    probe.spies = { selectAll, save }
    render(<Harness />)
    await user.click(selectAllButton())
    await answerMove(user, 'Cancel')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(selectAll).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(box('Fast Bite').getAttribute('aria-checked')).toBe('true')
    expect(box('KCF').getAttribute('aria-checked')).toBe('false')
    expect(box("Dono's Pizza").getAttribute('aria-checked')).toBe('false')
    expect(box('Subway').getAttribute('aria-checked')).toBe('false')
    expect(selectAllButton().getAttribute('aria-busy')).not.toBe('true')
  })

  it('confirming runs the block with the brand and moves every store', async () => {
    const user = userEvent.setup()
    const selectAll = vi.fn()
    probe.spies.selectAll = selectAll
    render(<Harness />)
    await user.click(selectAllButton())
    await answerMove(user, 'Move store')
    expect(selectAll).toHaveBeenCalledTimes(1)
    expect(selectAll).toHaveBeenCalledWith(true, 1)
    await waitFor(() => expect(screen.getAllByRole('checkbox').every(item => item.getAttribute('aria-checked') === 'true')).toBe(true))
  })

  it('«Select all» does not ask when the stores to take have no brand, nor for the ones already in this brand', async () => {
    const user = userEvent.setup()
    const selectAll = vi.fn()
    probe.spies.selectAll = selectAll
    // the id of this brand may come as a string: it is the same brand, not one to take from
    probe.businesses = [{ id: 11, name: 'Fast Bite', franchise_id: '1' }, STORES[2], STORES[3]]
    render(<Harness />)
    await user.click(selectAllButton())
    expect(selectAll).toHaveBeenCalledWith(true, 1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('says how many stores come from one brand', async () => {
    const user = userEvent.setup()
    probe.businesses = [STORES[0], STORES[1], { id: 16, name: 'Foster', franchise_id: 34 }, STORES[2]]
    render(<Harness />)
    await user.click(selectAllButton())
    const dialog = await moveDialog()
    expect(within(dialog).getByText('Move 2 stores from Vips to Burger Palace?')).toBeTruthy()
    expect(within(dialog).getByText(MOVE_BODY)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Move 2 stores' })).toBeTruthy()
  })

  it('says «from other brands» when the stores come from several brands', async () => {
    const user = userEvent.setup()
    probe.businesses = [STORES[0], STORES[1], { id: 15, name: 'Mystery', franchise_id: 99 }, STORES[2]]
    render(<Harness />)
    await user.click(selectAllButton())
    const dialog = await moveDialog()
    expect(within(dialog).getByText('Move 2 stores from other brands to Burger Palace?')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Move 2 stores' })).toBeTruthy()
  })

  it('names the source brand as «brand #id» when it is not in the loaded list, as the row does', async () => {
    const user = userEvent.setup()
    probe.businesses = [STORES[0], { id: 15, name: 'Mystery', franchise_id: 99 }]
    render(<Harness />)
    await user.click(selectAllButton())
    expect(await screen.findByText('Move Mystery from brand #99 to Burger Palace?')).toBeTruthy()
  })

  it('ticking one store of another brand asks first; Cancel leaves its box and writes nothing', async () => {
    const user = userEvent.setup()
    const check = vi.fn()
    probe.spies.check = check
    render(<Harness />)
    await user.click(box('KCF'))
    const dialog = await moveDialog()
    expect(within(dialog).getByText('Move KCF from Vips to Burger Palace?')).toBeTruthy()
    expect(within(dialog).getByText(MOVE_BODY_ONE)).toBeTruthy()
    expect(check).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(check).not.toHaveBeenCalled()
    expect(box('KCF').getAttribute('aria-checked')).toBe('false')
  })

  it('ticking one store of another brand saves it once the move is confirmed', async () => {
    const user = userEvent.setup()
    const check = vi.fn()
    probe.spies.check = check
    render(<Harness />)
    await user.click(box('KCF'))
    await answerMove(user, 'Move store')
    expect(check).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledWith(true, 12, 1)
    await waitFor(() => expect(box('KCF').getAttribute('aria-checked')).toBe('true'))
  })

  it('ticking a store without a brand, and unticking an own store, stay immediate', async () => {
    const user = userEvent.setup()
    const check = vi.fn()
    probe.spies.check = check
    render(<Harness />)
    await user.click(box('Subway'))
    expect(check).toHaveBeenLastCalledWith(true, 14, 1)
    await user.click(box('Fast Bite'))
    expect(check).toHaveBeenLastCalledWith(false, 11, 1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('«Select none» stays immediate', async () => {
    const user = userEvent.setup()
    const selectAll = vi.fn()
    probe.spies.selectAll = selectAll
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Select none' }))
    expect(selectAll).toHaveBeenCalledWith(false, 1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('BrandStores · states', () => {
  it('shows a skeleton busy region while loading, and no rows', () => {
    probe.listOverrides = { loading: true, businesses: [] }
    const { container } = render(<Harness />)
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText('Loading stores')).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('a failed load is an error with Retry, not «No stores to show» (M-SB7)', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    probe.spies.retry = retry
    probe.listOverrides = { businesses: [], error: ['Server down'] }
    render(<Harness />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain("We couldn't load the stores.")
    expect(alert.textContent).toContain('Server down')
    expect(screen.queryByText('No stores to show')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('an empty list says so, and says «No results» when a search found nothing', async () => {
    probe.businesses = []
    probe.pagination = { current_page: 1, total_pages: 0, page_size: 10, total: 0 }
    render(<Harness />)
    expect(screen.getByText('No stores to show')).toBeTruthy()
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Search stores' }), 'zzz{Enter}')
    expect(await screen.findByText('No results')).toBeTruthy()
    expect(screen.queryByText('No stores to show')).toBeNull()
  })
})

describe('BrandStores · search', () => {
  it('Enter searches at once', async () => {
    const user = userEvent.setup()
    const search = vi.fn()
    probe.spies.search = search
    render(<Harness />)
    await user.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'pizza{Enter}')
    expect(search).toHaveBeenCalledWith('pizza')
  })

  it('typing waits 750 ms (the lazy search of main) before it asks', () => {
    vi.useFakeTimers()
    try {
      const search = vi.fn()
      probe.spies.search = search
      render(<Harness />)
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search stores' }), { target: { value: 'piz' } })
      act(() => { vi.advanceTimersByTime(740) })
      expect(search).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(20) })
      expect(search).toHaveBeenCalledWith('piz')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('BrandStores · pagination', () => {
  it('has no foot with one page', () => {
    render(<Harness />)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('has a foot with page AND size, and both reach the controller (auditor 3)', async () => {
    const user = userEvent.setup()
    const page = vi.fn()
    const size = vi.fn()
    probe.spies = { page, size }
    probe.pagination = { current_page: 1, total_pages: 3, page_size: 10, total: 25 }
    render(<Harness />)
    const foot = screen.getByRole('navigation', { name: 'Pagination' })
    expect(foot.textContent).toContain('Showing')
    await user.click(within(foot).getByRole('button', { name: 'Next page' }))
    expect(page).toHaveBeenCalledWith(2)
    await user.click(within(foot).getByRole('button', { name: /10/ }))
    // the sizes of main: 10, 25 and 50
    expect((await screen.findAllByRole('menuitemradio')).map(item => item.textContent)).toEqual(['10', '25', '50'])
    await user.click(screen.getByRole('menuitemradio', { name: '25' }))
    expect(size).toHaveBeenCalledWith(25)
  })
})

describe('BrandStores · the wiring', () => {
  it('keeps the export, the fields it fetches and the search by name of main', () => {
    render(<Harness />)
    expect(probe.wiring).toEqual({ propsToFetch: ['id', 'name', 'logo', 'franchise_id'], isSearchByName: true })
  })
})
