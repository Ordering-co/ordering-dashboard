// (main #487), ported to the redesign: the notice the page shows above its list when no driver group has an active store.
// It replaced main's empty state inside StoresTable: the redesign lists every active store, so the notice sits above them.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { Route } from 'react-router-dom'
import { defaultTheme, renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ user: { level: 0 } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: state.user }]
}))

import { MissingGroupsState } from '../MissingGroupsState'

const NO_GROUPS_MESSAGE = 'Your stores are not in a driver group yet. Create a driver group and add your stores to it to see their drivers here.'
const NO_GROUP_STORES_MESSAGE = 'None of your active stores is in a driver group yet. Add them to a driver group to see their drivers here.'

const LocationProbe = () => (
  <Route render={({ location }) => <div data-testid='location'>{`${location.pathname}${location.search}`}</div>} />
)

const renderNotice = (props) => renderWithProviders(
  <>
    <MissingGroupsState {...props} />
    <LocationProbe />
  </>,
  { theme: defaultTheme }
)

describe('DriverStoreStatus MissingGroupsState', () => {
  beforeEach(() => {
    state.user = { level: 0 }
  })

  it('asks for a driver group and opens the add form when no group exists', () => {
    renderNotice({ hasGroups: false })
    expect(screen.getByRole('status')).toHaveTextContent(NO_GROUPS_MESSAGE)
    fireEvent.click(screen.getByRole('button', { name: 'Add driver group' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/delivery/drivers-groups?add=1')
  })

  it('asks to add stores to a group and opens Delivery Groups when groups have no active store', () => {
    renderNotice({ hasGroups: true })
    expect(screen.getByRole('status')).toHaveTextContent(NO_GROUP_STORES_MESSAGE)
    fireEvent.click(screen.getByRole('button', { name: 'Open Delivery Groups' }))
    expect(screen.getByTestId('location').textContent).toBe('/delivery/drivers-groups')
  })

  it('shows the message without the button to read-only admins', () => {
    state.user = { level: 0, readOnlyAdmin: true }
    renderNotice({ hasGroups: false })
    expect(screen.getByRole('status')).toHaveTextContent(NO_GROUPS_MESSAGE)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
