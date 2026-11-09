import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'
import { setIntercomAccess } from '../../../../utils/assistantIntercom'

const state = vi.hoisted(() => ({ session: {}, project: {}, config: {}, sales: [] }))
vi.mock('../../../../../../index', () => ({
  Home: ({ UIComponent, ...props }) => <UIComponent {...props} ordersList={{ loading: false, total: 0 }} todaySalelsList={{ loading: false, sales: 0 }} monthSalesList={{ loading: false, sales: state.sales }} getCurrentDateRange={() => ({})} disableSupportModule />,
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: value => String(value) }],
  useEvent: () => [{ emit: vi.fn() }],
  useSession: () => [state.session],
  useApi: () => [{}, { configurations: { subdomain: 'orderingplus' } }],
  useSite: () => [{ sites: [] }],
  useConfig: () => [state.config]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }] }))
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [state.project] }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))
vi.mock('../../../Shared', () => ({ Modal: () => null }))
vi.mock('../../../TrialExtension', () => ({ TrialExtensionHomeCard: () => null }))
vi.mock('react-chartjs-2', () => ({ Line: () => <div /> }))
import { HomePage } from '../index'

const renderHome = () => renderWithProviders(<HomePage />, { theme: { ...dashboardTheme, images: { project: { active: '', pastDuePayment: '' } } } })
const hashResponse = hash => ({ ok: true, json: async () => ({ error: false, result: { intercom_hash: hash } }) })

beforeEach(() => {
  state.session = { auth: true, token: 'a-token', user: { id: 1, level: 0, email: 'owner@example.test' } }
  state.project = { loading: false, intercomAllowed: true, planResolved: true, plan: { id: 100 }, project: { id: 1, code: 'alpha', current_status: 'active' } }
  state.config = { configs: {}, loading: false }
  state.sales = []
  setIntercomAccess(true, 'home-fixture')
  window.Intercom = vi.fn()
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})
afterEach(() => {
  cleanup()
  setIntercomAccess(false)
  vi.unstubAllGlobals()
})

describe('Home support identity updates', () => {
  it('never requests a support hash for the excluded plan even if access was previously enabled', () => {
    state.project.plan.id = '581'
    state.project.intercomAllowed = false
    renderHome()
    expect(fetch).not.toHaveBeenCalled()
    expect(window.Intercom).not.toHaveBeenCalled()
  })

  it('boots project metadata for an eligible plan', async () => {
    fetch.mockResolvedValue(hashResponse('current-hash'))
    renderHome()
    await act(async () => {})
    expect(window.Intercom).toHaveBeenCalledWith('boot', expect.objectContaining({
      project_plan: 100,
      user_hash: 'current-hash',
      company: { id: 1, name: 'alpha' }
    }))
  })

  it('discards an old hash after a different project finishes resolving', async () => {
    let oldHash
    fetch.mockImplementationOnce(() => new Promise(resolve => { oldHash = resolve }))
    const view = renderHome()
    state.project = { ...state.project, project: { id: 2, code: 'beta', current_status: 'active' }, plan: { id: 101 } }
    fetch.mockResolvedValue(hashResponse('new-hash'))
    view.rerender(<HomePage />)
    await act(async () => {})
    await act(async () => oldHash(hashResponse('stale-hash')))
    expect(window.intercomSettings).toMatchObject({ user_hash: 'new-hash', company: { id: 2, name: 'beta' } })
    expect(window.Intercom.mock.calls.filter(([command, settings]) => command === 'boot' && settings?.user_hash === 'stale-hash')).toEqual([])
  })

  it('discards a hash when Home is unmounted', async () => {
    let oldHash
    fetch.mockImplementationOnce(() => new Promise(resolve => { oldHash = resolve }))
    const view = renderHome()
    view.unmount()
    await act(async () => oldHash(hashResponse('stale-hash')))
    expect(window.Intercom).not.toHaveBeenCalled()
  })
})
