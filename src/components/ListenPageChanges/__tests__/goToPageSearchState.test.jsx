import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ session: {}, handlers: {}, emit: vi.fn(), merge: vi.fn() }))
vi.mock('~components', () => ({
  useSession: () => [state.session],
  useLanguage: () => [{ language: { rtl: false } }, (_key, fallback) => fallback],
  useEvent: () => [{ emit: state.emit, on: (name, handler) => { state.handlers[name] = handler }, off: (name) => { delete state.handlers[name] } }]
}))
vi.mock('~ui', () => ({ useTheme: () => [{ rtl: false }, { merge: state.merge }] }))
vi.mock('~/@/components-dashboard/src/ui/src/components/PageNotFound', () => ({ PageNotFound: () => <div>Page not found</div> }))
import { ListenPageChanges } from '../index'
import { ProtectedRoute } from '~/@/components-dashboard/src/ui/src/components/Shared/ProtectedRoute'

const Location = () => {
  const location = useLocation()
  return <div data-testid='location'>{JSON.stringify({ pathname: location.pathname, search: location.search, state: location.state ?? null })}</div>
}

const renderShell = () => renderWithProviders(
  <ListenPageChanges>
    <Location />
    <ProtectedRoute path='/stores/add' allowedLevels={[0, 2]}><h1>New business</h1></ProtectedRoute>
  </ListenPageChanges>,
  { initialEntries: ['/stores/list'] }
)

const currentLocation = () => JSON.parse(screen.getByTestId('location').textContent)

describe('go_to_page with a query string', () => {
  beforeEach(() => { state.session = { auth: true, user: { level: 0 } }; state.handlers = {}; state.emit.mockClear() })

  it('keeps the query string out of the pathname when navigation state is passed', () => {
    renderShell()

    act(() => state.handlers.go_to_page({ page: 'business_add', search: '?placeId=abc', state: { googleBusiness: { name: 'Joe’s' } } }))

    expect(currentLocation()).toEqual({ pathname: '/stores/add', search: '?placeId=abc', state: { googleBusiness: { name: 'Joe’s' } } })
    expect(screen.getByRole('heading', { name: 'New business' })).toBeInTheDocument()
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument()
  })

  it('still appends the query string when no state is passed', () => {
    renderShell()

    act(() => state.handlers.go_to_page({ page: 'business_add', search: '?placeId=abc' }))

    expect(currentLocation()).toEqual({ pathname: '/stores/add', search: '?placeId=abc', state: null })
    expect(screen.getByRole('heading', { name: 'New business' })).toBeInTheDocument()
  })
})
