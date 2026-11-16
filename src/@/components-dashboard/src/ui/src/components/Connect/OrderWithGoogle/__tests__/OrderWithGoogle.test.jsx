/* eslint-disable import/first */
// , part 3: Connect › Order with Google. The counters and the rows show the state the API gives, a counter filters the
// list, each row opens the store section that fits it (the one that fixes a store not sent), and the page shows nothing for a
// project without Google.
import React from 'react'
import { MemoryRouter, Route } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useSession: () => [{ user: state.user }],
  useApi: () => [{ project: {} }],
  useUtils: () => [{ getTimeAgo: () => '2 hours ago', optimizeImage: (src) => src }],
  // The controller is tested on its own; here it hands the UI what the test sets
  GoogleActionsStores: ({ UIComponent, ...props }) => (state.controllerProps = props) && (
    <UIComponent
      {...props}
      storesState={state.storesState}
      pagination={{ currentPage: 1, pageSize: 10, totalPages: 1, total: state.storesState.stores.length }}
      filter={state.filter}
      searchValue=''
      activeState={state.activeState}
      handleChangeActiveState={state.handleChangeActiveState}
      handleChangeFilter={state.handleChangeFilter}
      handleChangeSearch={() => {}}
      handleChangePage={state.handleChangePage}
      handleChangePageSize={() => {}}
    />
  )
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: () => {} }] }))
// The store's section is tested on its own; here it says which store and how it was opened, and reports a change
vi.mock('../../../Stores/BusinessOrderWithGoogle', () => ({
  BusinessOrderWithGoogle: ({ business, embedded, onChange }) => (
    <div data-testid='store-google-section'>
      {business.id} {embedded ? 'embedded' : 'page'}
      <button type='button' onClick={onChange}>changed</button>
    </div>
  )
}))
vi.mock('../../../../hooks/useGoogleActionsVisibility', () => ({ useGoogleActionsVisibility: () => state.visibility }))

import { OrderWithGoogle, getGoogleActionsRowSection } from '../index'

const store = (id, name, googleActions) => ({ id, name, slug: name.toLowerCase(), city: { name: 'New York' }, google_actions: googleActions })

let location
const renderPage = () => render(
  <MemoryRouter initialEntries={['/connect/order-with-google']}>
    <OrderWithGoogle />
    <Route path='*' render={(props) => { location = props.location; return null }} />
  </MemoryRouter>
)

beforeEach(() => {
  state.visibility = {
    loading: false,
    visible: true,
    status: { can_activate: true, counts: { sent: 2, ready: 0, processing: 0, skipped: 1, not_activated: 2594 } },
    refresh: vi.fn()
  }
  state.storesState = {
    loading: false,
    error: null,
    stores: [
      store(3, 'Taste Wine', { google_actions_status: 'sent', sent_url: 'https://tastewine.com/store/tastewine', checked_at: '2026-11-10 08:00:00' }),
      store(7, 'Demo Grill', { google_actions_status: 'skipped', status_reason: 'no_location', checked_at: '2026-11-09 08:00:00' }),
      store(9, 'New Place', null),
      store(12, 'Turned Off', { google_actions_status: 'not_activated', enabled: false, sent_url: 'https://old.example.com/off', checked_at: '2026-11-01 08:00:00' })
    ]
  }
  window.history.replaceState({}, '', '/')
  state.filter = null
  state.user = { level: 0 }
  state.activeState = true
  state.handleChangeActiveState = vi.fn()
  state.handleChangeFilter = vi.fn()
  state.handleChangePage = vi.fn()
})
afterEach(cleanup)

describe('OrderWithGoogle', () => {
  it('shows the counters the API gives, and a counter filters the list', () => {
    renderPage()
    const counts = screen.getByRole('list', { name: 'Stores by state' })
    const sent = within(counts).getByRole('button', { name: /Sent to Google/ })
    expect(sent).toHaveTextContent('2')
    expect(within(counts).getByRole('button', { name: /Not activated/ })).toHaveTextContent((2594).toLocaleString())

    fireEvent.click(sent)
    expect(state.handleChangeFilter).toHaveBeenCalledWith('sent')
  })

  it('marks the counter of the active filter', () => {
    state.filter = 'skipped'
    renderPage()
    expect(screen.getByRole('button', { name: /Not sent/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Sent to Google/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('lists each store by id with its city, its short state on Google and the link Google opens', () => {
    renderPage()
    expect(screen.getByRole('rowheader', { name: /Taste Wine/ })).toHaveTextContent('New York')
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('No location')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'tastewine.com/store/tastewine' })).toHaveAttribute('href', 'https://tastewine.com/store/tastewine')
    expect(screen.getAllByText('Not activated').length).toBeGreaterThan(1)
    // a store turned off keeps its last link on its row; the page does not show it
    expect(screen.queryByRole('link', { name: 'old.example.com/off' })).toBeNull()
  })

  it('switches between the Active and Inactive tabs', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Inactive' }))
    expect(state.handleChangeActiveState).toHaveBeenCalledWith(false)
  })

  it('opens a store in the panel beside the list, and sends a store not sent to the section that fixes it', () => {
    renderPage()
    expect(screen.getAllByRole('button', { name: 'Activate' }).length).toBe(2)
    expect(screen.getByRole('link', { name: 'Fix' })).toHaveAttribute('href', '/stores/list?id=7&section=store_details&tab=location')

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const panel = screen.getByTestId('store-google-section')
    expect(panel).toHaveTextContent('3 embedded')
    expect(location.pathname).toBe('/connect/order-with-google')
    expect(window.location.search).toBe('?id=3')

    // after an activation or a deactivation the panel reloads the page of stores
    fireEvent.click(within(panel).getByRole('button', { name: 'changed' }))
    expect(state.handleChangePage).toHaveBeenCalledWith(1)
  })

  it('goes to the store section that fixes why a store is not sent', () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: 'Fix' }))
    expect(`${location.pathname}${location.search}`).toBe('/stores/list?id=7&section=store_details&tab=location')
  })

  it('opens the panel instead of a section the person cannot open', () => {
    state.user = { level: 2, selected_access: true } // this role has no Store details
    renderPage()
    expect(screen.queryByRole('link', { name: 'Fix' })).toBeNull()
  })

  it('refreshes the project status and the page of stores', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(state.visibility.refresh).toHaveBeenCalled()
    expect(state.handleChangePage).toHaveBeenCalledWith(1)
  })

  it('shows nothing to do for a project without Google', () => {
    state.visibility = { loading: false, visible: false, status: { can_activate: false, counts: {} }, refresh: vi.fn() }
    renderPage()
    expect(screen.getByText('Order with Google is not available for this project yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Stores by state' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
  })
})

describe('OrderWithGoogle · ?state=', () => {
  it('opens on the state the address names (the Home sends skipped) and takes it out of the address', () => {
    window.history.replaceState({}, '', '/connect/order-with-google?state=skipped')
    renderPage()
    expect(state.controllerProps.defaultFilter).toBe('skipped')
    expect(window.location.search).toBe('')
  })

  it('ignores a state it does not know', () => {
    window.history.replaceState({}, '', '/connect/order-with-google?state=whatever')
    renderPage()
    expect(state.controllerProps.defaultFilter).toBeNull()
  })
})

describe('getGoogleActionsRowSection', () => {
  it('sends a store not sent to the section that fixes it, else to Order with Google', () => {
    expect(getGoogleActionsRowSection('skipped', 'no_schedule')).toBe('schedule')
    expect(getGoogleActionsRowSection('skipped', 'disabled')).toBe('google_actions')
    expect(getGoogleActionsRowSection('sent', null)).toBe('google_actions')
    expect(getGoogleActionsRowSection('not_activated', null)).toBe('google_actions')
  })
})
