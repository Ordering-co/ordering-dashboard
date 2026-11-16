/* eslint-disable import/first */
// redesign stores 3.B, G1-23: StoreRowControllers was one BusinessDetails controller per row; now it is one saver for
// the page. The contract the list relies on must not move, so the same press runs twice over the same fake API: once through the
// REAL BusinessDetails controller (a StoreRowSwitch outside StoreRowControllers still mounts it, as the rows did) and once through
// the saver. The request, the toasts, what the switch shows, the notice of a failure and what the list is handed back must be the
// same. The one difference is the point of the change: the controller also hands its store back when it mounts.
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  log: [], // everything the API and the toasts saw, in order
  respond: null, // (id, changes) => response | throws
  assistant: [] // the handlers subscribed to the assistant's record changes
}))

const fakeApi = {
  root: 'https://api.test',
  project: 'demo',
  setAccessToken: (token) => ({
    businesses: (id) => ({
      save: async (changes) => {
        mocks.log.push(['save', token, id, changes])
        return mocks.respond(id, changes)
      }
    })
  })
}
const showToast = (type, text) => mocks.log.push(['toast', type, text])
const hideToast = () => mocks.log.push(['hide-toast'])
const useAssistantRecordChanges = (handler) => {
  React.useEffect(() => {
    mocks.assistant.push(handler)
    return () => { mocks.assistant = mocks.assistant.filter(item => item !== handler) }
  })
}

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token', user: { level: 0 } }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [fakeApi] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast, hideToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_key, text) => text] }))
vi.mock('../../../../../../contexts/EventContext', () => ({ useEvent: () => [{ emit: vi.fn() }] }))
vi.mock('../../../../../../contexts/AssistantContext', () => ({ useAssistantRecordChanges: (handler) => useAssistantRecordChanges(handler) }))
// the barrel, reduced to what StoreRowSwitch takes from it: the real controller and the same contexts as the controller's
vi.mock('../../../../../../index', async () => {
  const { BusinessDetails } = await import('../../../../../../components/BusinessDetails')
  const { useSession } = await import('../../../../../../contexts/SessionContext')
  const { useApi } = await import('../../../../../../contexts/ApiContext')
  const { useToast, ToastType } = await import('../../../../../../contexts/ToastContext')
  const { useLanguage } = await import('../../../../../../contexts/LanguageContext')
  const assistant = await import('../../../../../../contexts/AssistantContext')
  return { BusinessDetails, useSession, useApi, useToast, ToastType, useLanguage, useAssistantRecordChanges: assistant.useAssistantRecordChanges }
})

import { StoreRowControllers, StoreRowSwitch } from '../StoreRowSwitch'

const STORE = { id: 7, name: 'Sample Burgers', enabled: true, featured: false, slug: 'sample-burgers' }
const OTHER = { id: 8, name: 'Fast Bite', enabled: false, featured: true, slug: 'fast-bite' }

const ok = (id, changes) => ({ content: { error: false, result: { id, ...changes, updated_at: '2026-10-10 12:00:00' } } })
const apiError = () => ({ content: { error: true, result: ['You cannot change this store'] } })
const boom = () => { throw new Error('Network down') }

// The old way: the switch with its own BusinessDetails controller (the real one)
const drawController = (business, props) => render(<StoreRowSwitch business={business} label={props.label} field={props.field} handleSucessUpdateBusiness={props.handleSucessUpdateBusiness} />)
// The new way: the same switch under the page's saver
const drawSaver = (business, props) => render(
  <StoreRowControllers businesses={[business]} handleSucessUpdateBusiness={props.handleSucessUpdateBusiness}>
    <StoreRowSwitch business={business} label={props.label} field={props.field} />
  </StoreRowControllers>
)

// redesign (owner decision 31 A): switching a store off asks first; this answers «Deactivate store»
const confirmOff = async (user) => {
  const dialog = await screen.findByRole('alertdialog', { name: /^Deactivate / })
  await user.click(within(dialog).getByRole('button', { name: 'Deactivate store' }))
}

// One press on one switch; what the API, the toasts, the switch and the list saw
const press = async (draw, { business = STORE, field = 'enabled', respond }) => {
  mocks.log = []
  mocks.respond = respond
  const handleSucessUpdateBusiness = vi.fn()
  const label = `${field} ${business.name}`
  const { unmount } = draw(business, { label, field, handleSucessUpdateBusiness })
  await act(async () => {})
  const mounted = handleSucessUpdateBusiness.mock.calls.length
  const toggle = screen.getByRole('switch', { name: label })
  const user = userEvent.setup()
  await user.click(toggle)
  if (field === 'enabled' && business.enabled) await confirmOff(user)
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
  const outcome = {
    log: mocks.log,
    checked: toggle.getAttribute('aria-checked'),
    notice: screen.queryByRole('alert')?.textContent ?? null,
    handedBack: handleSucessUpdateBusiness.mock.calls.slice(mounted)
  }
  unmount()
  return { ...outcome, mounted }
}

beforeEach(() => {
  mocks.log = []
  mocks.assistant = []
})

describe('StoreRowControllers (the page saver) — the same as the controller of the row', () => {
  it.each([
    ['Enable off, saved', { field: 'enabled', respond: ok }],
    ['Featured on, saved', { field: 'featured', respond: ok }],
    ['Enable off, refused by the API', { field: 'enabled', respond: apiError }],
    ['Featured on, the request throws', { field: 'featured', respond: boom }],
    ['Enable on an inactive store, saved', { business: OTHER, field: 'enabled', respond: ok }]
  ])('%s', async (_name, scenario) => {
    const before = await press(drawController, scenario)
    const after = await press(drawSaver, scenario)
    expect(after.log).toEqual(before.log)
    expect(after.checked).toBe(before.checked)
    expect(after.notice).toBe(before.notice)
    expect(after.handedBack).toEqual(before.handedBack)
    // the difference that is the point: the controller hands its store back when it mounts, the saver does not
    expect(before.mounted).toBe(1)
    expect(after.mounted).toBe(0)
  })

  it('a saved change is the request of today and hands the list the store with what the API returned', async () => {
    const after = await press(drawSaver, { field: 'enabled', respond: ok })
    expect(after.log).toEqual([
      ['toast', 'info', 'Loading'],
      ['save', 'test-token', 7, { enabled: false }],
      ['toast', 'success', 'Business updated']
    ])
    expect(after.checked).toBe('false')
    expect(after.handedBack).toEqual([[{ ...STORE, enabled: false, updated_at: '2026-10-10 12:00:00' }]])
  })
})

// redesign bugs F row 19: a failed save said its reason in the row but left the «Loading» toast up (no error toast
// replaces it, and the toast only hides after its duration). Both ways hide it on a failure and leave a success to replace it.
describe.each([['the controller of the row', drawController], ['the page saver', drawSaver]])('%s — the «Loading» toast after a save', (_name, draw) => {
  it.each([
    ['an API error', apiError],
    ['a request that throws', boom]
  ])('is hidden when the save fails with %s', async (_label, respond) => {
    const outcome = await press(draw, { field: 'enabled', respond })
    expect(outcome.log.filter(entry => entry[0] === 'hide-toast')).toHaveLength(1)
    expect(outcome.log.at(-1)).toEqual(['hide-toast'])
    expect(outcome.notice).not.toBeNull() // the reason is still said on the switch
  })

  it('is not hidden when the save works: «Business updated» replaces it', async () => {
    const outcome = await press(draw, { field: 'enabled', respond: ok })
    expect(outcome.log.some(entry => entry[0] === 'hide-toast')).toBe(false)
    expect(outcome.log.at(-1)).toEqual(['toast', 'success', 'Business updated'])
  })
})

describe('StoreRowControllers — one saver for every row', () => {
  const drawPage = (businesses, handleSucessUpdateBusiness = vi.fn()) => {
    const utils = render(
      <StoreRowControllers businesses={businesses} handleSucessUpdateBusiness={handleSucessUpdateBusiness}>
        {businesses.map(business => (
          <div key={business.id} data-testid={`row-${business.id}`}>
            <StoreRowSwitch business={business} field='enabled' label={`Enable ${business.name}`} />
            <StoreRowSwitch business={business} field='featured' tone='neutral' label={`Featured ${business.name}`} />
          </div>
        ))}
      </StoreRowControllers>
    )
    return { ...utils, handleSucessUpdateBusiness }
  }

  it('asks for nothing and hands nothing back when it mounts', async () => {
    const { handleSucessUpdateBusiness } = drawPage([STORE, OTHER])
    await act(async () => {})
    expect(mocks.log).toEqual([])
    expect(handleSucessUpdateBusiness).not.toHaveBeenCalled()
  })

  it('shows each switch with the stored value of its field, Featured in the neutral tone', () => {
    drawPage([STORE])
    expect(screen.getByRole('switch', { name: 'Enable Sample Burgers' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Enable Sample Burgers' })).not.toHaveAttribute('data-tone')
    expect(screen.getByRole('switch', { name: 'Featured Sample Burgers' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Featured Sample Burgers' })).toHaveAttribute('data-tone', 'neutral')
  })

  it('saves each store by its own id, once per change, and the second change starts from the first one', async () => {
    mocks.respond = ok
    const user = userEvent.setup()
    const { handleSucessUpdateBusiness } = drawPage([STORE, OTHER])
    await user.click(screen.getByRole('switch', { name: 'Enable Sample Burgers' }))
    await confirmOff(user)
    await waitFor(() => expect(handleSucessUpdateBusiness).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('switch', { name: 'Featured Sample Burgers' }))
    await waitFor(() => expect(handleSucessUpdateBusiness).toHaveBeenCalledTimes(2))
    expect(handleSucessUpdateBusiness.mock.calls[1][0]).toMatchObject({ id: 7, enabled: false, featured: true })
    await user.click(screen.getByRole('switch', { name: 'Enable Fast Bite' }))
    await waitFor(() => expect(handleSucessUpdateBusiness).toHaveBeenCalledTimes(3))
    expect(mocks.log.filter(entry => entry[0] === 'save').map(entry => [entry[2], entry[3]])).toEqual([
      [7, { enabled: false }],
      [7, { featured: true }],
      [8, { enabled: true }]
    ])
    expect(within(screen.getByTestId('row-8')).getByRole('switch', { name: 'Enable Fast Bite' })).toBeChecked()
  })

  it('keeps M-12: a save that fails goes back to the stored value and says why, on the switch that failed', async () => {
    mocks.respond = apiError
    const user = userEvent.setup()
    drawPage([STORE])
    const featured = screen.getByRole('switch', { name: 'Featured Sample Burgers' })
    await user.click(featured)
    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot change this store')
    expect(featured).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Enable Sample Burgers' })).toBeChecked()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('a new row object (a reload) wins over an old save', async () => {
    mocks.respond = ok
    const user = userEvent.setup()
    const handleSucessUpdateBusiness = vi.fn()
    const { rerender } = render(
      <StoreRowControllers businesses={[STORE]} handleSucessUpdateBusiness={handleSucessUpdateBusiness}>
        <StoreRowSwitch business={STORE} label='Enable Sample Burgers' />
      </StoreRowControllers>
    )
    await user.click(screen.getByRole('switch', { name: 'Enable Sample Burgers' }))
    await confirmOff(user)
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable Sample Burgers' })).not.toBeChecked())
    const reloaded = { ...STORE, enabled: true }
    rerender(
      <StoreRowControllers businesses={[reloaded]} handleSucessUpdateBusiness={handleSucessUpdateBusiness}>
        <StoreRowSwitch business={reloaded} label='Enable Sample Burgers' />
      </StoreRowControllers>
    )
    expect(screen.getByRole('switch', { name: 'Enable Sample Burgers' })).toBeChecked()
  })

  it('subscribes once to the assistant and hands back a change to a store on screen, not to another', async () => {
    const { handleSucessUpdateBusiness } = drawPage([STORE, OTHER])
    await act(async () => {})
    expect(mocks.assistant).toHaveLength(1)
    act(() => mocks.assistant[0]({ entity: 'Business', id: 8, after: { featured: false } }))
    expect(handleSucessUpdateBusiness).toHaveBeenCalledWith({ ...OTHER, featured: false })
    act(() => mocks.assistant[0]({ entity: 'Business', id: 99, after: { featured: false } }))
    act(() => mocks.assistant[0]({ entity: 'Product', id: 7, after: { name: 'x' } }))
    expect(handleSucessUpdateBusiness).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('switch', { name: 'Featured Fast Bite' })).not.toBeChecked()
  })
})

// (Z F5, coordinator: option A): a confirmed deactivation takes the store off the Active tab with its row, and the focus
// fell to <body> (the next Tab went to «Skip to content»). It goes to the Enabled switch of the store that now has that place (the
// one after it, or the one before when it was the last), to the h1 when none is left, and back to the same switch when the save fails.
describe('StoreRowControllers — the focus after a confirmed deactivation', () => {
  const A = { id: 21, name: 'Alpha', enabled: true, featured: false }
  const B = { id: 22, name: 'Bravo', enabled: true, featured: false }
  const C = { id: 23, name: 'Charlie', enabled: true, featured: false }

  // The Active tab: a store saved off leaves the list, as the list controller does with `handleSucessUpdateBusiness`
  const ActiveTab = ({ initial, cards }) => {
    const [rows, setRows] = React.useState(initial)
    const handBack = (record) => setRows(current => current.filter(row => row.id !== record.id || record.enabled))
    const Row = cards ? 'li' : 'div'
    return (
      <>
        <h1>Stores</h1>
        <StoreRowControllers businesses={rows} handleSucessUpdateBusiness={handBack}>
          {rows.map(business => (
            <Row key={business.id}>
              <StoreRowSwitch business={business} field='featured' tone='neutral' label={`Featured ${business.name}`} />
              <StoreRowSwitch business={business} field='enabled' label={`Enable ${business.name}`} />
            </Row>
          ))}
        </StoreRowControllers>
      </>
    )
  }

  const deactivate = async (user, name) => {
    await user.click(screen.getByRole('switch', { name: `Enable ${name}` }))
    await confirmOff(user)
    await waitFor(() => expect(screen.queryByRole('switch', { name: `Enable ${name}` })).toBeNull())
  }

  it('goes to the Enabled switch of the store that takes its place, and the success is still announced', async () => {
    mocks.respond = ok
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B, C]} />)
    await deactivate(user, 'Alpha')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Enable Bravo' })))
    expect(mocks.log).toContainEqual(['toast', 'success', 'Business updated'])
  })

  // live: the save ended while the closing dialog still held the focus, and the row went after it
  it('waits for a closing dialog that still holds the focus', async () => {
    let finish
    mocks.respond = (id, changes) => new Promise(resolve => { finish = () => resolve(ok(id, changes)) })
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B, C]} />)
    await user.click(screen.getByRole('switch', { name: 'Enable Alpha' }))
    await confirmOff(user)
    const closing = document.createElement('div')
    closing.setAttribute('role', 'alertdialog')
    closing.innerHTML = '<button type="button">Deactivate store</button>'
    document.body.appendChild(closing)
    closing.querySelector('button').focus()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    await act(async () => finish())
    await new Promise(resolve => setTimeout(resolve, 50))
    closing.remove()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Enable Bravo' })))
  })

  // review R1: cancel on one store, confirm on another, and the row leaves before the dialog has closed: Base UI hands the focus
  // to an earlier opener still on screen (the cancelled switch). That is still where the dialog left it, so it moves on.
  it('moves on from where the closing dialog left the focus, even when that is another store\'s switch', async () => {
    let finish
    mocks.respond = (id, changes) => new Promise(resolve => { finish = () => resolve(ok(id, changes)) })
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B, C]} />)
    await user.click(screen.getByRole('switch', { name: 'Enable Bravo' }))
    // jsdom closes the dialog at once; in the browser it is still closing (~450 ms) when the row leaves
    const closing = document.createElement('div')
    closing.setAttribute('role', 'alertdialog')
    document.body.appendChild(closing)
    await confirmOff(user)
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    await act(async () => finish())
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'Enable Bravo' })).toBeNull())
    closing.remove()
    screen.getByRole('switch', { name: 'Enable Alpha' }).focus() // Base UI's fallback as the dialog closes
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Enable Charlie' })))
  })

  it('leaves alone a focus the user moved while the store was saving', async () => {
    let finish
    mocks.respond = (id, changes) => new Promise(resolve => { finish = () => resolve(ok(id, changes)) })
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B, C]} />)
    await user.click(screen.getByRole('switch', { name: 'Enable Bravo' }))
    await confirmOff(user)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await act(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const alpha = screen.getByRole('switch', { name: 'Enable Alpha' })
    alpha.focus()
    await act(async () => finish())
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'Enable Bravo' })).toBeNull())
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(document.activeElement).toBe(alpha)
  })

  it('is the same in the cards', async () => {
    mocks.respond = ok
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B, C]} cards />)
    await deactivate(user, 'Bravo')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Enable Charlie' })))
  })

  it('goes to the one before when the store was the last one', async () => {
    mocks.respond = ok
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B, C]} />)
    await deactivate(user, 'Charlie')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Enable Bravo' })))
  })

  it('goes to the h1 when no store is left', async () => {
    mocks.respond = ok
    const user = userEvent.setup()
    render(<ActiveTab initial={[A]} />)
    await deactivate(user, 'Alpha')
    const heading = screen.getByRole('heading', { level: 1, name: 'Stores' })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    expect(heading).toHaveAttribute('tabindex', '-1')
  })

  it('stays on the same switch when the save fails', async () => {
    mocks.respond = apiError
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B]} />)
    const alpha = screen.getByRole('switch', { name: 'Enable Alpha' })
    await user.click(alpha)
    await confirmOff(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot change this store')
    await waitFor(() => expect(document.activeElement).toBe(alpha))
  })

  it('a Space on the switch that took the focus asks again before switching that store off (decision 31)', async () => {
    mocks.respond = ok
    const user = userEvent.setup()
    render(<ActiveTab initial={[A, B]} />)
    await deactivate(user, 'Alpha')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Enable Bravo' })))
    const saves = mocks.log.filter(entry => entry[0] === 'save').length
    await user.keyboard(' ')
    expect(await screen.findByRole('alertdialog', { name: 'Deactivate Bravo?' })).toBeInTheDocument()
    expect(mocks.log.filter(entry => entry[0] === 'save')).toHaveLength(saves)
  })
})
