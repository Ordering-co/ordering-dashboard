import React from 'react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
const state = vi.hoisted(() => ({ session: {}, logout: vi.fn() }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [state.session, { logout: state.logout }] }))
import { SourceCodeDownloads } from '../index'
import { PUBLIC_SOURCE_PRODUCTS, PUBLIC_SOURCE_TOOLS } from '../public-source-repositories'
let latest
const CaptureUI = props => { latest = props; return <div>{props.catalogStatus}</div> }
const authenticated = (level = 0) => ({ auth: true, token: 'fictitious-session', loading: false, user: { id: 1, level } })
beforeEach(() => { state.session = authenticated(); state.logout.mockReset(); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ZIP/R2 unavailable'))) })
afterEach(() => vi.unstubAllGlobals())
describe('public source controller', () => {
  it('maps the seven requested products and two developer tools to their exact public distributions', () => {
    const productNames = ['ordering-dashboard', 'website-marketplace', 'ordering-app-marketplace', 'ordering-app-business', 'ordering-app-driver', 'ordering-website-franchises', 'ordering-app-franchises']
    const toolNames = ['ordering-dev-quickstart', 'ordering-mcp-plugin']
    expect(PUBLIC_SOURCE_PRODUCTS.map(repo => repo.url)).toEqual(productNames.map(name => `https://github.com/Ordering-co/${name}`))
    expect(PUBLIC_SOURCE_TOOLS.map(repo => repo.url)).toEqual(toolNames.map(name => `https://github.com/Ordering-co/${name}`))
    expect(PUBLIC_SOURCE_PRODUCTS.map(repo => repo.platform)).toEqual(['web', 'web', 'mobile', 'mobile', 'mobile', 'web', 'mobile'])
  })
  it.each([0])('shows all public entries to existing authorized role %s without any catalog or GitHub request', level => {
    state.session = authenticated(level)
    renderWithProviders(<SourceCodeDownloads UIComponent={CaptureUI} />)
    expect(latest.catalogStatus).toBe('ready')
    expect(latest.products).toEqual(PUBLIC_SOURCE_PRODUCTS)
    expect(latest.tools).toEqual(PUBLIC_SOURCE_TOOLS)
    expect(fetch).not.toHaveBeenCalled()
    expect(JSON.stringify(latest)).not.toContain('fictitious-session')
    expect(latest).not.toHaveProperty('downloadSource')
  })
  it('immediately removes entries on logout or denied role and restores them on an eligible session', () => {
    const view = renderWithProviders(<SourceCodeDownloads UIComponent={CaptureUI} />)
    for (const [session, status] of [[{ loading: true }, 'loading'], [{ auth: false }, 'sessionExpired'], [authenticated(5), 'forbidden'], [authenticated(2), 'forbidden'], [{ ...authenticated(), user: { id: 1, level: 0, enabled: false } }, 'forbidden']]) {
      state.session = session
      view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
      expect(latest.catalogStatus).toBe(status)
      expect(latest.products).toEqual([])
      expect(latest.tools).toEqual([])
    }
    state.session = authenticated(0)
    view.rerender(<SourceCodeDownloads UIComponent={CaptureUI} />)
    expect(latest.products).toHaveLength(7)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('clears the session only on explicit sign-in and reports a retryable logout failure', async () => {
    state.session = { auth: false }
    renderWithProviders(<SourceCodeDownloads UIComponent={CaptureUI} />)
    expect(state.logout).not.toHaveBeenCalled()
    state.logout.mockRejectedValueOnce(new Error('controlled failure'))
    await act(() => latest.signInAgain())
    expect(latest.signInError).toBe(true)
    await act(() => latest.signInAgain())
    expect(latest.signInError).toBe(false)
    expect(state.logout).toHaveBeenCalledTimes(2)
  })
  it('supports the existing optional UI component contract', () => {
    const view = renderWithProviders(<SourceCodeDownloads />)
    expect(view.container).toBeEmptyDOMElement()
  })
})
