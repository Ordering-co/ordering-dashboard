import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ session: {}, handlers: {}, emit: vi.fn(), merge: vi.fn() }))
vi.mock('~components', () => ({
  useSession: () => [state.session],
  useLanguage: () => [{ language: { rtl: false } }, (_key, fallback) => fallback],
  useEvent: () => [{ emit: state.emit, on: (name, handler) => { state.handlers[name] = handler }, off: (name) => { delete state.handlers[name] } }]
}))
vi.mock('~ui', () => ({ useTheme: () => [{ rtl: false }, { merge: state.merge }] }))
vi.mock('~/@/components-dashboard/src/ui/src/components/PageNotFound', () => ({ PageNotFound: () => <div>Denied</div> }))
import { ListenPageChanges } from '../index'
import { ProtectedRoute } from '~/@/components-dashboard/src/ui/src/components/Shared/ProtectedRoute'

const Location = () => <div data-testid='location'>{useLocation().pathname}</div>
const renderRoute = (entry = '/home') => renderWithProviders(<ListenPageChanges><Location /><ProtectedRoute path='/free-downloads' allowedLevels={[0]}><h1>Download catalog</h1></ProtectedRoute></ListenPageChanges>, { initialEntries: [entry] })

describe('Free downloads route integration', () => {
  beforeEach(() => { state.session = { auth: true, user: { level: 0 } }; state.handlers = {}; state.emit.mockClear() })
  it('connects the shell route to the existing thin page and administrator guard', () => {
    const app = readFileSync('src/App.js', 'utf8')
    expect(app).toMatch(/import \{ FreeProductsList \} from '.\/pages\/FreeProductsList'/)
    expect(app).toMatch(/<ProtectedRoute path='\/free-downloads' allowedLevels=\{\[0\]\}>\s*<FreeProductsList \/>/)
  })
  it('resolves the sidebar event and emits a stable current view', () => {
    const { unmount } = renderRoute()
    act(() => state.handlers.go_to_page({ page: 'free_products' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/free-downloads')
    expect(screen.getByRole('heading', { name: 'Download catalog' })).toBeInTheDocument()
    expect(state.emit).toHaveBeenCalledWith('change_view', { page: 'free_products', params: {}, query: {} })
    unmount()
    expect(state.handlers.go_to_page).toBeUndefined()
  })
  it.each([2, 5, 8, undefined])('denies the deep link for role %s', (level) => {
    state.session = { auth: true, user: level === undefined ? undefined : { level } }
    renderRoute('/free-downloads')
    expect(screen.queryByRole('heading', { name: 'Download catalog' })).not.toBeInTheDocument()
    expect(screen.getByText('Denied')).toBeInTheDocument()
  })
  it('redirects signed-out sessions to login', () => {
    state.session = { auth: false }
    renderRoute('/free-downloads')
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
    expect(screen.queryByRole('heading', { name: 'Download catalog' })).not.toBeInTheDocument()
  })
  it('preserves existing order navigation', () => {
    renderRoute()
    act(() => state.handlers.go_to_page({ page: 'orders' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/orders')
  })
})
