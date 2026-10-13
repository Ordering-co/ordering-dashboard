import React from 'react'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { vi, afterEach, beforeEach, describe, it, expect } from 'vitest'
import { StoreOnboardingGate } from './index'
import { createDraft, draftKey } from '../../@/components-dashboard/src/utils/storeOnboarding'
const state = vi.hoisted(() => ({ session: {}, root: 'https://test/project', discover: vi.fn(), clearMedia: vi.fn() }))
vi.mock('../../@/components-dashboard/src/utils/storeOnboardingDraftMedia', () => ({ deleteDraftMedia: (...args) => state.clearMedia(...args) }))
vi.mock('~ui', () => ({ Button: props => <button {...props} /> }))
vi.mock('~components', () => ({
  useApi: () => [{ root: state.root }],
  useSession: () => [state.session, { logout: vi.fn() }],
  useLanguage: () => [null, (key, fallback) => fallback]
}))
vi.mock('../../@/components-dashboard/src/utils/useStoreOnboardingLanguage', () => ({ useStoreOnboardingLanguage: () => [null, (key, fallback) => fallback] }))
vi.mock('../../@/components-dashboard/src/utils/storeOnboardingApi', () => ({ createOnboardingApi: () => ({ discover: state.discover }) }))
vi.mock('../../pages/StoreOnboarding', () => ({ StoreOnboarding: ({ onComplete }) => <><button onClick={onComplete}>Finish walkthrough</button><button onClick={() => onComplete('orders')}>Open Orders manager</button><button onClick={() => onComplete('https://evil.example')}>Invalid destination</button></> }))
const mount = () => render(<MemoryRouter><StoreOnboardingGate><div>Normal dashboard</div></StoreOnboardingGate></MemoryRouter>)
beforeEach(() => {
  localStorage.clear()
  state.session = { auth: true, token: 'session', user: { id: 1, level: 0 } }
  state.discover.mockReset()
  state.clearMedia.mockReset(); state.clearMedia.mockImplementation(async (key, beforeDelete) => beforeDelete ? beforeDelete() : true)
})
afterEach(cleanup)
describe('local first store gate', () => {
  it('leaves the dashboard visible until an empty project is confirmed, then gates until Continue', async () => {
    let finish
    state.discover.mockReturnValue(new Promise(resolve => { finish = resolve }))
    mount()
    expect(screen.getByText('Normal dashboard')).toBeTruthy()
    finish(true)
    await screen.findByText('Finish walkthrough')
    expect(screen.queryByText('Normal dashboard')).toBeNull()
    fireEvent.click(screen.getByText('Finish walkthrough'))
    await screen.findByText('Normal dashboard')
  })
  it('keeps existing-store and non-admin flows', async () => {
    state.discover.mockResolvedValue(false)
    const view = mount()
    await screen.findByText('Normal dashboard')
    view.unmount()
    state.session.user.level = 2
    state.discover.mockClear()
    mount()
    expect(screen.getByText('Normal dashboard')).toBeTruthy()
    expect(state.discover).not.toHaveBeenCalled()
  })
  it('fails closed with retry on lookup error when progress already exists', async () => {
    localStorage.setItem(draftKey(state.root, 1), JSON.stringify(createDraft('owner@example.com')))
    state.discover.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true)
    mount()
    await screen.findByRole('alert')
    expect(screen.queryByText('Normal dashboard')).toBeNull()
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByText('Finish walkthrough')
  })
  it('ignores a stale response when the project changes', async () => {
    let finish
    state.discover.mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValueOnce(true)
    const view = mount()
    state.root = 'https://test/another'
    view.rerender(<MemoryRouter><StoreOnboardingGate><div>Normal dashboard</div></StoreOnboardingGate></MemoryRouter>)
    await screen.findByText('Finish walkthrough')
    finish(false)
    await waitFor(() => expect(screen.queryByText('Normal dashboard')).toBeNull())
    state.root = 'https://test/project'
  })
})

it('clears obsolete progress after a confirmed deleted store and permits a fresh walkthrough', async () => {
  const key = draftKey(state.root, 1); const draft = createDraft('owner@example.com'); draft.journal.businessId = 3
  localStorage.setItem(key, JSON.stringify(draft))
  state.discover.mockResolvedValue('reset-required')
  mount()
  await screen.findByText('Finish walkthrough')
  expect(localStorage.getItem(key)).toBeNull()
})
it('ignores a stale deletion result after switching project and preserves its saved progress', async () => {
  const key = draftKey(state.root, 1); const draft = createDraft('owner@example.com'); draft.journal.businessId = 3
  localStorage.setItem(key, JSON.stringify(draft))
  let finish
  state.discover.mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValueOnce(true)
  const view = mount(); state.root = 'https://test/switched'
  view.rerender(<MemoryRouter><StoreOnboardingGate><div>Normal dashboard</div></StoreOnboardingGate></MemoryRouter>)
  await screen.findByText('Finish walkthrough'); finish('reset-required')
  await waitFor(() => expect(localStorage.getItem(key)).not.toBeNull())
  state.root = 'https://test/project'
})

it('recovers a corrupt local draft only after confirming the project store state', async () => {
  const key = draftKey(state.root, 1); localStorage.setItem(key, '{corrupt')
  state.discover.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true)
  mount()
  await screen.findByRole('alert')
  expect(localStorage.getItem(key)).toBe('{corrupt')
  fireEvent.click(screen.getByText('Try again'))
  await screen.findByText('Finish walkthrough')
  expect(state.discover).toHaveBeenCalledWith(null, expect.any(AbortSignal))
  expect(localStorage.getItem(key)).toBeNull()
})

const Location = () => { const location = useLocation(); return <p>{location.pathname}{location.search}</p> }
it('unlocks the dashboard, clears progress and opens Orders manager directly or Home', async () => {
  for (const [button, destination] of [['Open Orders manager', '/orders'], ['Finish walkthrough', '/home'], ['Invalid destination', '/home']]) {
    const key = draftKey(state.root, 1)
    localStorage.setItem(key, JSON.stringify(createDraft('owner@example.com')))
    state.discover.mockResolvedValue(true)
    render(<MemoryRouter><StoreOnboardingGate><Location /></StoreOnboardingGate></MemoryRouter>)
    fireEvent.click(await screen.findByText(button))
    expect(await screen.findByText(destination)).toBeTruthy()
    expect(localStorage.getItem(key)).toBeNull()
    cleanup()
  }
})

it('preserves progress and stays gated if browser storage cannot clear on Orders manager exit', async () => {
  const key = draftKey(state.root, 1)
  localStorage.setItem(key, JSON.stringify(createDraft('owner@example.com')))
  state.discover.mockResolvedValue(true)
  render(<MemoryRouter><StoreOnboardingGate><Location /></StoreOnboardingGate></MemoryRouter>)
  await screen.findByText('Open Orders manager')
  const remove = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
  try {
    fireEvent.click(screen.getByText('Open Orders manager'))
    await screen.findByRole('alert')
    expect(localStorage.getItem(key)).not.toBeNull()
    expect(screen.queryByText('/orders')).toBeNull()
  } finally { remove.mockRestore() }
})

it('keeps routes mounted while no-draft discovery is pending or fails', async () => {
  let fail
  state.discover.mockReturnValue(new Promise((resolve, reject) => { fail = reject }))
  mount()
  expect(screen.getByText('Normal dashboard')).toBeTruthy()
  fail(new Error('offline'))
  await waitFor(() => expect(state.discover).toHaveBeenCalledOnce())
  expect(screen.getByText('Normal dashboard')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
it('does not remount a confirmed onboarding or rediscover on API language changes', async () => {
  state.root = 'https://api.orderingplus.com/v400/en/project'
  state.discover.mockResolvedValue(true)
  const view = mount()
  await screen.findByText('Finish walkthrough')
  const button = screen.getByText('Finish walkthrough')
  state.root = 'https://api.orderingplus.com/v400/es/project'
  view.rerender(<MemoryRouter><StoreOnboardingGate><div>Normal dashboard</div></StoreOnboardingGate></MemoryRouter>)
  expect(screen.getByText('Finish walkthrough')).toBe(button)
  expect(state.discover).toHaveBeenCalledOnce()
  state.root = 'https://test/project'
})

it('keeps newly started progress gated when another tab saves during a pending failed discovery', async () => {
  let fail
  state.discover.mockReturnValue(new Promise((resolve, reject) => { fail = reject }))
  mount()
  expect(screen.getByText('Normal dashboard')).toBeTruthy()
  const key = draftKey(state.root, 1)
  const value = JSON.stringify(createDraft('owner@example.com'))
  localStorage.setItem(key, value)
  fireEvent(window, new StorageEvent('storage', { key, newValue: value }))
  expect(screen.queryByText('Normal dashboard')).toBeNull()
  fail(new Error('offline'))
  await screen.findByRole('alert')
  expect(screen.queryByText('Normal dashboard')).toBeNull()
})

it('ignores unrelated progress and ordinary checkpoints once the onboarding owner is mounted', async () => {
  state.discover.mockResolvedValue(true)
  mount()
  const button = await screen.findByText('Finish walkthrough')
  const key = draftKey(state.root, 1); const value = JSON.stringify(createDraft('owner@example.com'))
  localStorage.setItem(key, value)
  fireEvent(window, new StorageEvent('storage', { key: 'other-project', newValue: value }))
  fireEvent(window, new StorageEvent('storage', { key, newValue: value }))
  fireEvent(window, new StorageEvent('storage', { key, newValue: null }))
  expect(screen.getByText('Finish walkthrough')).toBe(button)
  expect(state.discover).toHaveBeenCalledOnce()
})
it('retains nonempty corrupt progress created during discovery when lookup fails', async () => {
  let fail
  state.discover.mockReturnValue(new Promise((resolve, reject) => { fail = reject }))
  mount()
  const key = draftKey(state.root, 1)
  localStorage.setItem(key, '{corrupt')
  fireEvent(window, new StorageEvent('storage', { key, newValue: '{corrupt' }))
  fail(new Error('offline'))
  await screen.findByRole('alert')
  expect(localStorage.getItem(key)).toBe('{corrupt')
  expect(screen.queryByText('Normal dashboard')).toBeNull()
})

it('cleans the discarded draft media when discovery confirms a reset', async () => {
  const key = draftKey(state.root, 1)
  const draft = createDraft('owner@example.com'); draft.journal.businessId = 3
  localStorage.setItem(key, JSON.stringify(draft))
  state.discover.mockResolvedValue('reset-required')
  mount()
  await screen.findByText('Finish walkthrough')
  expect(state.clearMedia).toHaveBeenCalledOnce()
  expect(state.clearMedia.mock.calls[0][0]).toBe(key)
  expect(localStorage.getItem(key)).toBeNull()
})
