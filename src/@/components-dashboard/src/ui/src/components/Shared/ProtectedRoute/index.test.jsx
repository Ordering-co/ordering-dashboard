/* eslint-disable import/first */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ session: {} }))
vi.mock('../../../../../index', () => ({ useSession: () => [runtime.session] }))
vi.mock('../../PageNotFound', () => ({ PageNotFound: () => <div>Denied route</div> }))

import { ProtectedRoute } from './index'

const LoginTarget = () => {
  const location = useLocation()
  return <output>{JSON.stringify({ pathname: location.pathname, from: location.state?.from })}</output>
}
const renderRoute = initial => render(
  <MemoryRouter initialEntries={[initial]}>
    <Switch>
      <ProtectedRoute path='/private' allowedLevels={[0, 2]}><div>Allowed route</div></ProtectedRoute>
      <Route path='/login'><LoginTarget /></Route>
    </Switch>
  </MemoryRouter>
)

describe('L2 ProtectedRoute contract', () => {
  it('renders children for authenticated allowed levels', () => {
    runtime.session = { auth: true, user: { level: 2 } }
    renderRoute('/private')
    expect(screen.getByText('Allowed route')).toBeInTheDocument()
  })

  it('renders PageNotFound for authenticated denied levels', () => {
    runtime.session = { auth: true, user: { level: 5 } }
    renderRoute('/private')
    expect(screen.getByText('Denied route')).toBeInTheDocument()
  })

  it('redirects unauthenticated users to login with the protected path in state', () => {
    runtime.session = { auth: false, user: null }
    renderRoute('/private')
    expect(JSON.parse(screen.getByRole('status').textContent)).toEqual({ pathname: '/login', from: '/private' })
  })
})
