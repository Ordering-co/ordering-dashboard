/* eslint-disable import/first */
// bugs E: /stores/add only checked the level, so a store owner whose project forbids owners to register stores
// (`allow_business_owner_register_business` off) reached the add page by URL. The route now applies the rule of the list and ⌘K.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Switch } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ user: { level: 2 }, configs: {}, loading: false, fetchedWithToken: true }))

vi.mock('~components', () => ({
  useSession: () => [{ user: mockState.user }],
  useConfig: () => [{ configs: mockState.configs, loading: mockState.loading, fetchedWithToken: mockState.fetchedWithToken }]
}))

import { RegisterStoresGate } from './index'

const draw = () => render(
  <MemoryRouter initialEntries={['/stores/add']}>
    <Switch>
      <Route path='/stores/add'>
        <RegisterStoresGate><p>add page</p></RegisterStoresGate>
      </Route>
      <Route path='/stores/list'><p>stores list</p></Route>
    </Switch>
  </MemoryRouter>
)

beforeEach(() => {
  mockState.user = { level: 2 }
  mockState.configs = {}
  mockState.loading = false
  mockState.fetchedWithToken = true
})

describe('RegisterStoresGate', () => {
  it('lets an owner in when the project has no setting or has it on', () => {
    draw()
    expect(screen.getByText('add page')).toBeInTheDocument()
    mockState.configs = { allow_business_owner_register_business: { value: '1' } }
    draw()
    expect(screen.getAllByText('add page')).toHaveLength(2)
  })

  it('sends an owner to the stores list when the project forbids owners to register stores', () => {
    mockState.configs = { allow_business_owner_register_business: { value: '0' } }
    draw()
    expect(screen.queryByText('add page')).toBeNull()
    expect(screen.getByText('stores list')).toBeInTheDocument()
  })

  it('an admin always gets in', () => {
    mockState.user = { level: 0 }
    mockState.configs = { allow_business_owner_register_business: { value: '0' } }
    draw()
    expect(screen.getByText('add page')).toBeInTheDocument()
  })

  // review (bugs E): in production the Worker's first load gives only the public settings with `loading: false`; the owner rule
  // needs the account's own settings, so an owner waits for them (an admin does not depend on the setting)
  it('makes an owner wait for the settings of the session, not the public first load', () => {
    mockState.fetchedWithToken = false
    draw()
    expect(screen.queryByText('add page')).toBeNull()
    expect(screen.queryByText('stores list')).toBeNull()
    mockState.user = { level: 0 }
    draw()
    expect(screen.getByText('add page')).toBeInTheDocument()
  })

  it('draws nothing while the project settings load (no flash of the form, no early redirect)', () => {
    mockState.loading = true
    mockState.configs = {}
    draw()
    expect(screen.queryByText('add page')).toBeNull()
    expect(screen.queryByText('stores list')).toBeNull()
  })
})
