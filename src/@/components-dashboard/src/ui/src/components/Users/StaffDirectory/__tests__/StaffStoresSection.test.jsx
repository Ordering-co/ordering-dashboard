/* eslint-disable import/first */
// redesign BO-B5 (decision 6; BO-1, BO-2, BO-3, BO-9): the Stores section of the staff record. The REAL controller
// (K/BusinessManagerBusinesses) runs on a simulated API: the SDK chain and `fetch` are fakes, so NOTHING here reaches a
// server. What is pinned is what the section shows, what it sends to `save` and when it reports changes.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn(),
  translations: {},
  session: { token: 'token', user: { id: 1, level: 0 } },
  ordering: { root: 'https://api.test' }
}))

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, text) => mocks.translations[key] ?? text]
}))
// The section reads the controller and the language from the index: the real controller, by its file, and the same translator
vi.mock('../../../../../../index', async () => {
  const { BusinessManagerBusinesses } = await vi.importActual('../../../../../../components/BusinessManagerBusinesses')
  return {
    BusinessManagerBusinesses,
    useLanguage: () => [{ dictionary: {} }, (key, text) => mocks.translations[key] ?? text]
  }
})

import { StaffStoresSection } from '../StaffStoresSection'

const REREAD_ERROR = 'The stores were saved, but we couldn\'t read them back. Retry to see what was assigned.'

const business = (id) => ({ id, name: `Store ${id}` })
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index)

const makeChain = ({ assigned = range(1, 31).map(business), key = 'businesses' } = {}) => {
  const chain = {}
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.get = vi.fn(async () => ({ content: { error: false, result: { [key]: assigned } } }))
  // the answer of one store added (POST) or removed (DELETE) through users/{id}/businesses/{business_id}
  chain.save = vi.fn(async () => ({ content: { error: false, result: {} } }))
  // the owners of the saved stores, read on their own chain; by default nobody is the only owner of anything
  const owners = {}
  owners.select = vi.fn(() => owners)
  owners.asDashboard = vi.fn(() => owners)
  owners.where = vi.fn(() => owners)
  owners.get = vi.fn(async () => ({ content: { error: false, result: [] } }))
  chain.businesses = vi.fn(() => owners)
  chain.owners = owners
  return chain
}

// The backoffice catalog is read with `fetch`: `pages` maps a page number to the businesses it returns, 31 in total.
const mockCatalog = (pages, total = 31) => {
  global.fetch = vi.fn(async (url, options = {}) => {
    const assignment = new URL(url).pathname.match(/^\/users\/\d+\/businesses\/(\d+)$/)
    if (assignment) {
      const { content } = await mocks.chain.save({ method: options.method, id: Number(assignment[1]) })
      return { json: async () => content }
    }
    const page = Number(new URL(url).searchParams.get('page'))
    return {
      json: async () => ({
        error: false,
        result: pages[page] || [],
        pagination: { current_page: page, total_pages: Object.keys(pages).length, total }
      })
    }
  })
}
const catalogUrls = () => global.fetch.mock.calls.map(([url]) => decodeURIComponent(url)).filter(url => !/\/users\/\d+\/businesses\/\d+$/.test(url))
// the stores a save added or removed, in order
const assignments = () => mocks.chain.save.mock.calls.map(([{ method, id }]) => [method, id])

const setup = ({ assigned, key } = {}) => {
  mocks.chain = makeChain({ assigned, key })
  mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  mockCatalog({ 1: range(1, 10).map(business), 2: range(11, 20).map(business) })
}

const renderSection = (props = {}) => {
  const handlers = { onDirtyChange: vi.fn(), onSaved: vi.fn() }
  const view = render(<StaffStoresSection userId={5} storesKey='businesses' {...handlers} {...props} />)
  return { ...view, ...handlers }
}

const assignedRegion = () => screen.getByRole('region', { name: 'Assigned stores' })
const addRegion = () => screen.getByRole('region', { name: 'Add stores' })
const ready = () => waitFor(() => {
  expect(within(addRegion()).getByRole('checkbox', { name: 'Store 1' })).toBeInTheDocument()
})
const saveBar = () => screen.queryByRole('group', { name: 'Stores' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.translations = {}
  setup()
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
  delete global.fetch
})

describe('the assigned stores', () => {
  it('lists the 31 assigned stores by name, each ticked, with their count and no save bar', async () => {
    renderSection()
    await ready()
    const assigned = within(assignedRegion())
    const boxes = assigned.getAllByRole('checkbox')
    expect(boxes).toHaveLength(31)
    expect(boxes.every(box => box.getAttribute('aria-checked') === 'true')).toBe(true)
    expect(assigned.getByRole('checkbox', { name: 'Store 31' })).toBeInTheDocument()
    expect(assignedRegion().querySelector('.odc-figure').textContent).toBe('31')
    expect(saveBar()).toBeNull()
  })

  it('the controller is asked for the user\'s own `storesKey`', async () => {
    setup({ assigned: [business(4), business(9)], key: 'businesses_agent' })
    renderSection({ storesKey: 'businesses_agent' })
    await ready()
    expect(mocks.chain.select).toHaveBeenCalledWith(['businesses_agent'])
    expect(within(assignedRegion()).getAllByRole('checkbox').map(box => box.getAttribute('aria-label') ?? box.textContent)).toEqual(['Store 4', 'Store 9'])
  })

  it('a store with no known name is shown as «#id»', async () => {
    setup({ assigned: [{ id: 99 }, business(2)] })
    renderSection()
    await ready()
    expect(within(assignedRegion()).getByRole('checkbox', { name: '#99' })).toBeInTheDocument()
  })

  it('with none assigned it says so and points to the list below', async () => {
    setup({ assigned: [] })
    renderSection()
    await ready()
    expect(within(assignedRegion()).getByText('No stores assigned yet. Add them below.')).toBeInTheDocument()
    expect(within(assignedRegion()).queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('unticking one strikes it out in place with «Will be removed», counts 1 change, and Discard brings it back', async () => {
    const user = userEvent.setup()
    renderSection()
    await ready()

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' }))

    const box = within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    expect(box).toHaveAccessibleDescription('Will be removed')
    expect(box.closest('li')).toHaveAttribute('data-state', 'removed')
    expect(within(assignedRegion()).getAllByRole('checkbox')).toHaveLength(31)
    expect(within(saveBar()).getByText('1 change')).toBeInTheDocument()
    // the catalog row follows the selection
    expect(within(addRegion()).getByRole('checkbox', { name: 'Store 3' })).toHaveAttribute('aria-checked', 'false')

    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))

    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' })).toHaveAttribute('aria-checked', 'true')
    expect(within(assignedRegion()).queryByText('Will be removed')).toBeNull()
    expect(saveBar()).toBeNull()
  })
})

describe('adding stores (BO-1)', () => {
  it('«Select all on this page» adds page 1 to the 30 assigned ones and Save sends all 31', async () => {
    setup({ assigned: range(2, 31).map(business) })
    const user = userEvent.setup()
    const { onSaved } = renderSection()
    await ready()
    expect(within(addRegion()).getByRole('checkbox', { name: 'Store 1' })).toHaveAttribute('aria-checked', 'false')

    await user.click(within(addRegion()).getByRole('button', { name: 'Select all on this page' }))

    const added = within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' })
    expect(added).toHaveAccessibleDescription('Will be added')
    expect(within(saveBar()).getByText('1 change')).toBeInTheDocument()

    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    // only the new one travels; the 30 already assigned stay
    expect(assignments()).toEqual([['POST', 1]])
    expect(saveBar()).toBeNull()
  })

  it('ticking one catalog row adds it; unticking an unsaved one just drops it from the list', async () => {
    setup({ assigned: [business(20)] })
    const user = userEvent.setup()
    renderSection()
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 4' }))
    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 4' })).toHaveAttribute('aria-checked', 'true')
    expect(within(saveBar()).getByText('1 change')).toBeInTheDocument()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 5' }))
    expect(within(saveBar()).getByText('2 changes')).toBeInTheDocument()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 4' }))
    expect(within(assignedRegion()).queryByRole('checkbox', { name: 'Store 4' })).toBeNull()
    expect(within(saveBar()).getByText('1 change')).toBeInTheDocument()
  })

  it('«Select none» empties the whole selection, as main did: every assigned store is marked for removal', async () => {
    const user = userEvent.setup()
    renderSection()
    await ready()

    await user.click(within(addRegion()).getByRole('button', { name: 'Select none' }))

    expect(within(assignedRegion()).getAllByRole('checkbox').every(box => box.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(within(saveBar()).getByText('31 changes')).toBeInTheDocument()
  })

  it('«Select none» is disabled when nothing is selected', async () => {
    setup({ assigned: [] })
    renderSection()
    await ready()
    expect(within(addRegion()).getByRole('button', { name: 'Select none' })).toBeDisabled()
  })

  it('selecting a store and then going to page 2 keeps it selected', async () => {
    setup({ assigned: [] })
    const user = userEvent.setup()
    renderSection()
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 2' }))
    await user.click(within(addRegion()).getByRole('button', { name: 'Next page' }))

    await waitFor(() => expect(within(addRegion()).getByRole('checkbox', { name: 'Store 11' })).toBeInTheDocument())
    expect(catalogUrls().at(-1)).toContain('page=2')
    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 2' })).toBeInTheDocument()
  })

  it('the page size menu asks for 25 stores from page 1', async () => {
    const user = userEvent.setup()
    renderSection()
    await ready()

    await user.click(screen.getByRole('button', { name: /Items per page/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: '25' }))

    await waitFor(() => expect(catalogUrls().at(-1)).toContain('page_size=25'))
    expect(catalogUrls().at(-1)).toContain('page=1&')
  })
})

describe('searching the catalog', () => {
  it('Enter sends the search at once; the clear button sends an empty one', async () => {
    const user = userEvent.setup()
    renderSection()
    await ready()
    const before = catalogUrls().length

    await user.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'pizza{Enter}')
    await waitFor(() => expect(catalogUrls()).toHaveLength(before + 1))
    expect(catalogUrls().at(-1)).toContain('%pizza%')

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => expect(catalogUrls()).toHaveLength(before + 2))
    expect(catalogUrls().at(-1)).not.toContain('where=')
  })

  it('typing alone waits 500 ms before it sends, and sends once', async () => {
    const user = userEvent.setup()
    renderSection()
    await ready()
    const before = catalogUrls().length

    await user.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'pizza')
    expect(catalogUrls()).toHaveLength(before)

    await waitFor(() => expect(catalogUrls()).toHaveLength(before + 1), { timeout: 2000 })
    expect(catalogUrls().at(-1)).toContain('%pizza%')
  })

  it('no results says so', async () => {
    const user = userEvent.setup()
    renderSection()
    await ready()
    mockCatalog({})

    await user.type(screen.getByRole('searchbox', { name: 'Search stores' }), 'zzz{Enter}')

    expect(await within(addRegion()).findByText('No stores match this search')).toBeInTheDocument()
    expect(within(addRegion()).queryAllByRole('checkbox')).toHaveLength(0)
  })
})

describe('saving (BO-2)', () => {
  it('on success it reports the new stores with their names under `storesKey`, and the bar goes', async () => {
    setup({ assigned: [business(1), business(2)], key: 'businesses' })
    const user = userEvent.setup()
    const { onSaved } = renderSection({ storesKey: 'businesses' })
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 7' }))
    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(assignments()).toEqual([['POST', 7], ['DELETE', 1]])
    expect(onSaved).toHaveBeenCalledWith({
      id: 5,
      businesses: [{ id: 2, name: 'Store 2' }, { id: 7, name: 'Store 7' }]
    })
    await waitFor(() => expect(saveBar()).toBeNull())
    // Store 1 is gone from the assigned list: it was saved as removed
    expect(within(assignedRegion()).queryByRole('checkbox', { name: 'Store 1' })).toBeNull()
  })

  it('a business owner is not read again: the host gets what was sent, and the stores are read once', async () => {
    setup({ assigned: [business(1)], key: 'businesses' })
    const user = userEvent.setup()
    const { onSaved } = renderSection({ storesKey: 'businesses' })
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 2' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved).toHaveBeenCalledWith({ id: 5, businesses: [{ id: 1, name: 'Store 1' }, { id: 2, name: 'Store 2' }] })
    expect(mocks.chain.get).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(REREAD_ERROR)).toBeNull()
  })

  it('an API error opens the notice with its message, keeps the changes and does not report a save', async () => {
    const user = userEvent.setup()
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: ['Nope, not allowed'] } })
    const { onSaved } = renderSection()
    await ready()

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText('The stores weren\'t saved')).toBeInTheDocument()
    expect(within(alert).getByText('Nope, not allowed')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()

    await user.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    // the changes are still there to try again
    expect(within(saveBar()).getByText('1 change')).toBeInTheDocument()
    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' })).toHaveAttribute('aria-checked', 'false')
  })

  it('an error with no message says «Something went wrong. Try again.»', async () => {
    const user = userEvent.setup()
    mocks.chain.save.mockRejectedValue(new Error(''))
    renderSection()
    await ready()

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    expect(await within(await screen.findByRole('alertdialog')).findByText('Something went wrong. Try again.')).toBeInTheDocument()
  })

  it('an API message goes through the translation of its key', async () => {
    const user = userEvent.setup()
    mocks.translations = { NOPE_NOT_ALLOWED: 'No se permite' }
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: ['Nope not allowed'] } })
    renderSection()
    await ready()

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    expect(await within(await screen.findByRole('alertdialog')).findByText('No se permite')).toBeInTheDocument()
  })
})

// redesign (CA-5, decision 10): an agent's stores are read from `businesses_agent` and written as `businesses`, so what was
// sent is not proof of what the server has: after a good save the section reads them again and reports what it read.
describe('saving the stores of an agent', () => {
  const answer = (list) => ({ content: { error: false, result: { businesses_agent: list } } })
  const agent = (assigned) => {
    setup({ assigned, key: 'businesses_agent' })
    return renderSection({ storesKey: 'businesses_agent' })
  }

  it('reads the stores again after saving and reports what the server has, not what was sent', async () => {
    mocks.chain.get = vi.fn().mockResolvedValueOnce(answer([])).mockResolvedValueOnce(answer([business(5)]))
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    const user = userEvent.setup()
    const { onSaved } = renderSection({ storesKey: 'businesses_agent' })
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 5' }))
    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 6' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(assignments()).toEqual([['POST', 5], ['POST', 6]])
    expect(mocks.chain.get).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenCalledWith({ id: 5, businesses_agent: [{ id: 5, name: 'Store 5' }] })
    await waitFor(() => expect(saveBar()).toBeNull())
  })

  it('keeps the bar saving, and reports nothing, until the second read comes back', async () => {
    let finish
    mocks.chain.get = vi.fn().mockResolvedValueOnce(answer([business(1)])).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    const user = userEvent.setup()
    const { onSaved } = renderSection({ storesKey: 'businesses_agent' })
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 2' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    await waitFor(() => expect(mocks.chain.get).toHaveBeenCalledTimes(2))
    expect(saveBar()).toHaveAttribute('data-saving')
    expect(onSaved).not.toHaveBeenCalled()
    expect(mocks.chain.save).toHaveBeenCalledTimes(1)

    finish(answer([business(1), business(2)]))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved).toHaveBeenCalledWith({ id: 5, businesses_agent: [{ id: 1, name: 'Store 1' }, { id: 2, name: 'Store 2' }] })
    await waitFor(() => expect(saveBar()).toBeNull())
  })

  it('a store the server returns with no name is reported as «#id»', async () => {
    mocks.chain.get = vi.fn().mockResolvedValueOnce(answer([])).mockResolvedValueOnce(answer([{ id: 8 }]))
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    const user = userEvent.setup()
    const { onSaved } = renderSection({ storesKey: 'businesses_agent' })
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 3' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved).toHaveBeenCalledWith({ id: 5, businesses_agent: [{ id: 8, name: '#8' }] })
  })

  it('a failed second read reports nothing, says the stores were saved, and keeps Retry; a Retry that works reports what it read', async () => {
    mocks.chain.get = vi.fn()
      .mockResolvedValueOnce(answer([]))
      .mockResolvedValueOnce({ content: { error: true, result: ['Boom'] } })
      .mockResolvedValueOnce(answer([business(3)]))
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    const user = userEvent.setup()
    const { onSaved } = renderSection({ storesKey: 'businesses_agent' })
    await ready()

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 3' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    expect(await screen.findByText(REREAD_ERROR)).toBeInTheDocument()
    expect(screen.getByText('We couldn\'t load the assigned stores. Nothing can change until they load.')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(mocks.chain.save).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved).toHaveBeenCalledWith({ id: 5, businesses_agent: [{ id: 3, name: 'Store 3' }] })
    expect(screen.queryByText(REREAD_ERROR)).toBeNull()
    expect(mocks.chain.save).toHaveBeenCalledTimes(1)
  })

  // R2-1 (review r1, finding 1): a good save whose second read is not what was sent must not look like a plain success
  describe('when what the server kept is not what was sent (R2-1)', () => {
    const MISMATCH = 'Saved, but the server kept 3 stores for this user. What you see is what it has.'
    const notice = () => screen.queryByText(MISMATCH)?.closest('[role="status"]') ?? null
    const readAs = (...second) => {
      mocks.chain.get = vi.fn().mockResolvedValueOnce(answer([])).mockResolvedValueOnce(answer(second.map(business)))
      mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
    }
    const saveFiveAndSix = async (user) => {
      await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 5' }))
      await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 6' }))
      await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))
    }

    it('sent [5, 6] and read back [5, 6, 7]: still reports what was read, and shows a persistent status above «Assigned» with the count read', async () => {
      readAs(5, 6, 7)
      const user = userEvent.setup()
      const { onSaved } = renderSection({ storesKey: 'businesses_agent' })
      await ready()

      await saveFiveAndSix(user)

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
      expect(onSaved).toHaveBeenCalledWith({ id: 5, businesses_agent: [{ id: 5, name: 'Store 5' }, { id: 6, name: 'Store 6' }, { id: 7, name: 'Store 7' }] })
      await waitFor(() => expect(notice()).not.toBeNull())
      // the controller's own toasts are not the notice: the text is in the page, not in a toast
      expect(mocks.showToast.mock.calls.some(([, text]) => text === MISMATCH)).toBe(false)
      // it sits above the «Assigned» block
      expect(notice().compareDocumentPosition(assignedRegion()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('the notice goes at the next change of the selection', async () => {
      readAs(5, 6, 7)
      const user = userEvent.setup()
      renderSection({ storesKey: 'businesses_agent' })
      await ready()
      await saveFiveAndSix(user)
      await waitFor(() => expect(notice()).not.toBeNull())

      await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 7' }))

      expect(notice()).toBeNull()
    })

    it('sent [5, 6] and read back [5, 6]: nothing new', async () => {
      readAs(5, 6)
      const user = userEvent.setup()
      const { onSaved } = renderSection({ storesKey: 'businesses_agent' })
      await ready()

      await saveFiveAndSix(user)

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
      expect(screen.queryByText(/Saved, but the server kept/)).toBeNull()
    })

    it('read back in another order is the same set: nothing new', async () => {
      readAs(6, 5)
      const user = userEvent.setup()
      const { onSaved } = renderSection({ storesKey: 'businesses_agent' })
      await ready()

      await saveFiveAndSix(user)

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
      expect(screen.queryByText(/Saved, but the server kept/)).toBeNull()
    })

    it('a business owner is never compared: no notice', async () => {
      setup({ assigned: [business(1)], key: 'businesses' })
      const user = userEvent.setup()
      const { onSaved } = renderSection({ storesKey: 'businesses' })
      await ready()

      await saveFiveAndSix(user)

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
      expect(screen.queryByText(/Saved, but the server kept/)).toBeNull()
    })
  })

  it('a save the API refuses is not read again', async () => {
    const user = userEvent.setup()
    const { onSaved } = agent([business(1)])
    await ready()
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: ['Nope, not allowed'] } })

    await user.click(within(addRegion()).getByRole('checkbox', { name: 'Store 2' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    await screen.findByRole('alertdialog')
    expect(mocks.chain.get).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByText(REREAD_ERROR)).toBeNull()
  })
})

describe('unsaved changes', () => {
  it('reports true on the first change and false when it is discarded or saved', async () => {
    const user = userEvent.setup()
    const { onDirtyChange } = renderSection()
    await ready()
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)

    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
  })

  it('unticking and ticking the same store again is no change', async () => {
    const user = userEvent.setup()
    renderSection()
    await ready()
    const box = within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' })
    await user.click(box)
    await user.click(box)
    expect(saveBar()).toBeNull()
  })

  it('leaving with unsaved changes tells the host it is clean again', async () => {
    const user = userEvent.setup()
    const { onDirtyChange, unmount } = renderSection()
    await ready()
    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 3' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)

    unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

describe('a store keeps at least one owner', () => {
  const ownedBy = (...ids) => ids.map((id) => ({ id, name: `Person ${id}` }))
  // Store 1 has only this user (5) as owner; Store 2 has another one too
  const soleOwnerOfStore1 = () => {
    setup({ assigned: [business(1), business(2)] })
    mocks.chain.owners.get.mockResolvedValue({ content: { error: false, result: [{ id: 1, owners: ownedBy(5) }, { id: 2, owners: ownedBy(5, 8) }] } })
  }

  it('asks for the owners of the saved stores, and keeps the one the user is the only owner of ticked, saying why', async () => {
    soleOwnerOfStore1()
    renderSection()
    await ready()

    const lastOwner = within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' })
    await waitFor(() => expect(lastOwner).toBeDisabled())
    expect(lastOwner).toHaveAccessibleDescription('A store needs at least one owner.')
    expect(within(addRegion()).getByRole('checkbox', { name: 'Store 1' })).toBeDisabled()
    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 2' })).toBeEnabled()
    expect(mocks.chain.owners.select).toHaveBeenCalledWith(['id', 'owners'])
    expect(mocks.chain.owners.where).toHaveBeenCalledWith({ conditions: [{ attribute: 'id', value: [1, 2] }], conector: 'AND' })
  })

  it('«Select none» leaves it, and Save sends it', async () => {
    soleOwnerOfStore1()
    const user = userEvent.setup()
    renderSection()
    await ready()
    await waitFor(() => expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' })).toBeDisabled())

    await user.click(within(addRegion()).getByRole('button', { name: 'Select none' }))
    await user.click(within(saveBar()).getByRole('button', { name: 'Save stores' }))

    // store 1 stays: only store 2 leaves
    await waitFor(() => expect(assignments()).toEqual([['DELETE', 2]]))
  })

  it('with 60 stores it asks in pages of at most 50, as GET /business answers 10 when asked for more', async () => {
    setup({ assigned: range(1, 60).map(business) })
    // Like the API: past 50 it ignores page_size and answers 10. Store 55 is the user's alone.
    mocks.chain.owners.get.mockImplementation(async ({ query }) => {
      const ids = mocks.chain.owners.where.mock.lastCall[0].conditions[0].value
      const page = query.page_size > 50 ? ids.slice(0, 10) : ids
      return { content: { error: false, result: page.map((id) => ({ id, owners: id === 55 ? ownedBy(5) : ownedBy(5, 8) })) } }
    })
    renderSection()
    await ready()

    await waitFor(() => expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 55' })).toBeDisabled())
    expect(mocks.chain.owners.where.mock.calls.map(([where]) => where.conditions[0].value)).toEqual([range(1, 50), range(51, 60)])
    expect(mocks.chain.owners.get.mock.calls.map(([options]) => options.query.page_size)).toEqual([50, 10])
  })

  it('a page that comes back short keeps nothing of its own', async () => {
    soleOwnerOfStore1()
    mocks.chain.owners.get.mockResolvedValue({ content: { error: false, result: [{ id: 1, owners: ownedBy(5) }] } })
    const user = userEvent.setup()
    renderSection()
    await ready()
    await waitFor(() => expect(mocks.chain.owners.get).toHaveBeenCalled())

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' }))

    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' })).toHaveAttribute('aria-checked', 'false')
  })

  it('if the owners cannot be read, nothing is kept: the API still refuses', async () => {
    soleOwnerOfStore1()
    mocks.chain.owners.get.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    renderSection()
    await ready()

    await user.click(within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' }))

    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' })).toHaveAttribute('aria-checked', 'false')
  })

  it('an agent\'s stores are not owned: their owners are not read', async () => {
    setup({ assigned: [business(1)], key: 'businesses_agent' })
    renderSection({ storesKey: 'businesses_agent' })
    await ready()

    expect(mocks.chain.businesses).not.toHaveBeenCalled()
    expect(within(assignedRegion()).getByRole('checkbox', { name: 'Store 1' })).toBeEnabled()
  })
})

describe('the assigned stores did not load (BO-9)', () => {
  it('while they load: skeletons, no boxes and no bar', async () => {
    mocks.chain.get = vi.fn(() => new Promise(() => {}))
    renderSection()
    await waitFor(() => expect(screen.getAllByRole('status', { busy: true }).length).toBeGreaterThanOrEqual(1))
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(saveBar()).toBeNull()
  })

  it('on an error: no boxes, no save, a message, and Retry asks again; once they load the list is there', async () => {
    const user = userEvent.setup()
    mocks.chain.get.mockResolvedValueOnce({ content: { error: true, result: ['Boom'] } })
    renderSection()

    const alert = await screen.findByText('We couldn\'t load the assigned stores. Nothing can change until they load.')
    expect(alert.closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Save stores' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Select all on this page' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await ready()
    expect(mocks.chain.get).toHaveBeenCalledTimes(2)
    expect(within(assignedRegion()).getAllByRole('checkbox')).toHaveLength(31)
  })

  it('a read that throws is the same: nothing to tick, Retry', async () => {
    mocks.chain.get.mockRejectedValueOnce(new Error('network down'))
    renderSection()
    expect(await screen.findByText('We couldn\'t load the assigned stores. Nothing can change until they load.')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('the catalog failed (BO-3)', () => {
  it('shows an error with Retry that asks for the same page again; the assigned stores stay', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn(async () => ({ json: async () => ({ error: true, result: ['Catalog down'] }) }))
    renderSection()

    const alert = await within(await waitFor(() => addRegion())).findByText('We couldn\'t load the stores.')
    expect(alert.closest('[role="alert"]')).not.toBeNull()
    await waitFor(() => expect(within(assignedRegion()).getAllByRole('checkbox')).toHaveLength(31))
    expect(within(addRegion()).queryAllByRole('checkbox')).toHaveLength(0)

    mockCatalog({ 1: range(1, 10).map(business) })
    await user.click(within(addRegion()).getByRole('button', { name: 'Retry' }))

    await ready()
    expect(catalogUrls()).toHaveLength(1)
    expect(within(addRegion()).queryByText('We couldn\'t load the stores.')).toBeNull()
  })

  it('while the catalog loads it draws skeletons, not an empty list', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    renderSection()
    await waitFor(() => expect(within(assignedRegion()).getAllByRole('checkbox')).toHaveLength(31))
    expect(within(addRegion()).getByRole('status', { busy: true })).toBeInTheDocument()
    expect(within(addRegion()).queryAllByRole('checkbox')).toHaveLength(0)
  })
})

describe('words', () => {
  it('the texts go through the translator with their keys', async () => {
    mocks.translations = {
      STAFF_STORES_ASSIGNED: 'Tiendas asignadas',
      STAFF_STORES_ADD: 'Añadir tiendas',
      STAFF_STORES_SELECT_PAGE: 'Seleccionar la página'
    }
    renderSection()
    await waitFor(() => expect(screen.getByRole('region', { name: 'Tiendas asignadas' })).toBeInTheDocument())
    expect(await screen.findByRole('region', { name: 'Añadir tiendas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar la página' })).toBeInTheDocument()
  })
})
