/* eslint-disable import/first */
// , part 2: the store's «Order with Google» section. It shows the state the API gives, activates with the site and
// the consent, points a store that is not sent at the section that fixes it, and asks before deactivating.
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useUtils: () => [{ getTimeAgo: () => '5 minutes ago' }],
  useSession: () => [{ user: state.user }],
  // The controller is tested on its own; here it hands the UI what the test sets
  BusinessGoogleActions: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      statusState={state.statusState}
      sitesState={state.sitesState}
      actionState={state.actionState}
      getSites={() => {}}
      handleActivate={state.handleActivate}
      handleDeactivate={state.handleDeactivate}
      clearActionError={() => {}}
    />
  )
}))
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push: state.push }) }))
vi.mock('../../../../hooks/useGoogleActionsVisibility', () => ({ useGoogleActionsVisibility: () => ({ refresh: state.refresh }) }))

import { BusinessOrderWithGoogle } from '../index'

const site = { id: 4, url: 'https://shop.example.com' }
const loaded = (data) => ({ loading: false, error: null, data: { current_consent_version: '2026-11-03', can_activate: true, ...data } })

beforeEach(() => {
  state.statusState = loaded({ enabled: false, google_actions_status: 'not_activated' })
  state.sitesState = { loading: false, loaded: true, sites: [site] }
  state.actionState = { loading: false, error: null, code: null, reason: null }
  state.handleActivate = vi.fn(async () => true)
  state.handleDeactivate = vi.fn(async () => true)
  state.refresh = vi.fn()
  state.user = { level: 0 }
  state.push = vi.fn()
})
afterEach(cleanup)

describe('BusinessOrderWithGoogle', () => {
  it('activates only after the consent is accepted, with the chosen site', async () => {
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} />)
    const activate = screen.getByRole('button', { name: 'Accept and activate' })
    expect(activate).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(activate).toBeEnabled())
    fireEvent.click(activate)

    await waitFor(() => expect(state.handleActivate).toHaveBeenCalledWith(4))
    expect(state.refresh).toHaveBeenCalled()
  })

  it('shows the state the API gives, sent included, without working it out', () => {
    state.statusState = loaded({ enabled: true, google_actions_status: 'sent', status: 'ready', sent_url: 'https://shop.example.com/centro' })
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} />)
    expect(screen.getByText('Sent to Google')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://shop.example.com/centro' })).toBeInTheDocument()
  })

  it('says why a store is not sent and opens the section that fixes it', () => {
    const onOpenSection = vi.fn()
    state.statusState = loaded({ enabled: true, google_actions_status: 'skipped', status: 'skipped', status_reason: 'no_schedule' })
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} onOpenSection={onOpenSection} />)
    expect(screen.getByText('The store has no weekly hours.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Schedule' }))
    expect(onOpenSection).toHaveBeenCalledWith('schedule', undefined)
  })

  it('sends a store without delivery or pickup time to Delivery, pickup & more', () => {
    const onOpenSection = vi.fn()
    state.statusState = loaded({ enabled: true, google_actions_status: 'skipped', status: 'skipped', status_reason: 'no_lead_time' })
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} onOpenSection={onOpenSection} />)
    expect(screen.getByText('The store has no delivery or pickup time. Google needs it for each service it shows.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Delivery, pickup & more' }))
    expect(onOpenSection).toHaveBeenCalledWith('delivery_pickup_more', undefined)
  })

  it('sends a missing currency to the project setting, which only level 0 opens', () => {
    // the currency sent to Google is the project's stripe_currency, not the store's
    state.statusState = loaded({ enabled: true, google_actions_status: 'skipped', status: 'skipped', status_reason: 'no_currency' })
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} onOpenSection={vi.fn()} />)
    expect(screen.getByText('The project has no currency. Set it in Settings › Card payments (Stripe).')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Card payments (Stripe)' }))
    expect(state.push).toHaveBeenCalledWith('/settings?group=payments&category=stripe&focus=stripe_currency')
    cleanup()

    state.user = { level: 2 }
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} onOpenSection={vi.fn()} />)
    expect(screen.getByText('The project has no currency. Set it in Settings › Card payments (Stripe).')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Card payments (Stripe)' })).toBeNull()
  })

  it('when the API refuses the activation for something the store lacks, says what and opens the section that fixes it', () => {
    const onOpenSection = vi.fn()
    state.actionState = { loading: false, error: ['The store cannot be sent to Google yet'], code: 'google_actions.not_eligible', reason: 'no_location' }
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} onOpenSection={onOpenSection} />)
    expect(screen.getByText('The store has no address or map location.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Store details' }))
    expect(onOpenSection).toHaveBeenCalledWith('store_details', 'location')
  })

  it('offers no section the person cannot open', () => {
    state.actionState = { loading: false, error: ['The store cannot be sent to Google yet'], code: 'google_actions.not_eligible', reason: 'no_location' }
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} onOpenSection={vi.fn()} canOpenSection={() => false} />)
    expect(screen.getByText('The store has no address or map location.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Store details' })).toBeNull()
  })

  it('asks before deactivating', async () => {
    state.statusState = loaded({ enabled: true, google_actions_status: 'ready', status: 'ready' })
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate on Google' }))
    expect(state.handleDeactivate).not.toHaveBeenCalled()

    const confirm = await screen.findAllByRole('button', { name: 'Deactivate on Google' })
    fireEvent.click(confirm[confirm.length - 1])
    await waitFor(() => expect(state.handleDeactivate).toHaveBeenCalled())
  })

  it('shows nothing to do for a project that cannot activate yet', () => {
    state.statusState = loaded({ enabled: false, google_actions_status: 'not_activated', can_activate: false })
    render(<BusinessOrderWithGoogle business={{ id: 3, slug: 'centro' }} />)
    expect(screen.getByText('Order with Google is not available for this project yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept and activate' })).toBeNull()
  })
})
