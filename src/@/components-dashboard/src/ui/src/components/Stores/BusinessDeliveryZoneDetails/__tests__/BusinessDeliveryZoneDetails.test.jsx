import React from 'react'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, it, expect, afterEach, beforeEach, describe } from 'vitest'
import { BusinessDeliveryZoneDetails } from '../index'

// redesign stores 5.8 (2.3): the body of the detail of P/SectionSplit (which draws the title, the X and Esc). G3-22 stays:
// Snooze, the actions menu and Share with are for a saved zone only. The legacy Modal, react-bootstrap and the <h1> are gone.
const mocks = vi.hoisted(() => ({
  addQueryToUrl: vi.fn(),
  handleDelete: vi.fn(),
  informationProps: null
}))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

// The controller only hands the zone it was given to the UI; the UI is what is under test.
vi.mock('../../../../../../components/BusinessDeliveryZone', () => ({
  BusinessDeliveryZone: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      zoneState={{ zone: props.zone }}
      formState={{ loading: false, changes: {} }}
      handleDeleteBusinessDeliveryZone={mocks.handleDelete}
    />
  )
}))

vi.mock('../../BusinessDeliveryZoneInformation', () => ({
  BusinessDeliveryZoneInformation: (props) => {
    mocks.informationProps = props
    return <div data-testid='zone-information' data-active={String(props.active)} />
  }
}))
vi.mock('../../BusinessDeliveryZoneShare', () => ({
  BusinessDeliveryZoneShare: () => <div data-testid='zone-share' />
}))
vi.mock('../../SnoozeComponent', () => ({
  SnoozeComponent: () => <div data-testid='zone-snooze' />
}))
vi.mock('../../../../utils', () => ({
  addQueryToUrl: (...args) => mocks.addQueryToUrl(...args)
}))

beforeEach(() => {
  mocks.addQueryToUrl.mockClear()
  mocks.handleDelete.mockReset()
  mocks.informationProps = null
})
afterEach(cleanup)

const SAVED = { id: 5, name: 'Downtown' }
const tree = zone => <BusinessDeliveryZoneDetails zone={zone} business={{ id: 2, zones: [] }} businessZones={[]} />
const renderZone = (zone, entry = '/stores/list?id=2&section=delivery_pickup_more') => {
  const user = userEvent.setup()
  const utils = render(<MemoryRouter initialEntries={[entry]}>{tree(zone)}</MemoryRouter>)
  return { user, ...utils, rerenderZone: next => utils.rerender(<MemoryRouter initialEntries={[entry]}>{tree(next)}</MemoryRouter>) }
}
const tab = name => screen.getByRole('tab', { name })

describe('BusinessDeliveryZoneDetails (G3-22)', () => {
  it('offers Snooze, the actions menu and Share with for a saved zone', () => {
    renderZone(SAVED)
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zone actions' })).toBeTruthy()
    expect(tab('Share with')).toBeTruthy()
    expect(tab('Information').getAttribute('aria-selected')).toBe('true')
  })

  it('draws no title of its own: the split puts the name of the zone', () => {
    renderZone(SAVED)
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByText('Downtown')).toBeNull()
  })

  it('hides Snooze, the actions menu and Share with until the zone is saved', () => {
    renderZone(null)
    expect(screen.queryByRole('button', { name: 'Snooze' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Zone actions' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Share with' })).toBeNull()
    expect(tab('Information')).toBeTruthy()
    expect(screen.getByTestId('zone-information')).toBeTruthy()
  })

  it('opens Information, not Share, when a new zone arrives with zone_tab=share_with', () => {
    renderZone(null, '/stores/list?id=2&section=delivery_pickup_more&zone_tab=share_with')
    expect(screen.queryByTestId('zone-share')).toBeNull()
    expect(screen.getByTestId('zone-information').getAttribute('data-active')).toBe('true')
  })

  it('leaves Share for Information when the open panel switches to a new zone', async () => {
    const { user, rerenderZone } = renderZone(SAVED)
    await user.click(tab('Share with'))
    expect(screen.getByTestId('zone-share')).toBeTruthy()
    rerenderZone(null)
    expect(screen.queryByTestId('zone-share')).toBeNull()
    expect(screen.getByTestId('zone-information').getAttribute('data-active')).toBe('true')
    expect(tab('Information').getAttribute('aria-selected')).toBe('true')
  })

  it('still opens Share from the URL for a saved zone', () => {
    renderZone(SAVED, '/stores/list?id=2&section=delivery_pickup_more&zone=5&zone_tab=share_with')
    expect(screen.getByTestId('zone-share')).toBeTruthy()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })
})

describe('the tab in the URL (zone_tab)', () => {
  it('writes the tab to the URL when the user changes it, and not when it is read', async () => {
    const { user } = renderZone(SAVED, '/stores/list?id=2&zone_tab=information')
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    await user.click(tab('Share with'))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ zone_tab: 'share_with' })
    await user.click(tab('Information'))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ zone_tab: 'information' })
  })

  it('opens Information, and says so in the URL, when there is no zone_tab', () => {
    renderZone(SAVED)
    expect(tab('Information').getAttribute('aria-selected')).toBe('true')
    expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ zone_tab: 'information' })
  })

  // redesign bugs F row 31: «Add delivery zone» removes zone and zone_tab; a new zone must not write zone_tab back without zone=.
  it('does not write zone_tab to the URL for a new zone', () => {
    renderZone(null, '/stores/list?id=2&section=delivery_pickup_more')
    expect(tab('Information').getAttribute('aria-selected')).toBe('true')
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('does not write zone_tab for a new zone that arrives with an unknown one', () => {
    renderZone(null, '/stores/list?id=2&section=delivery_pickup_more&zone_tab=channels')
    expect(tab('Information').getAttribute('aria-selected')).toBe('true')
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('an unknown zone_tab (the old «channels») opens Information', () => {
    renderZone(SAVED, '/stores/list?id=2&zone_tab=channels')
    expect(tab('Information').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('zone-information').getAttribute('data-active')).toBe('true')
    expect(screen.queryByTestId('zone-share')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Channels' })).toBeNull()
  })

  it('keeps Information mounted (with its pending changes and its guard) while Share is in front', async () => {
    const { user } = renderZone(SAVED)
    await user.click(tab('Share with'))
    expect(screen.getByTestId('zone-share')).toBeTruthy()
    expect(screen.getByTestId('zone-information').getAttribute('data-active')).toBe('false')
    expect(screen.getByTestId('zone-information').parentElement.hidden).toBe(true)
    await user.click(tab('Information'))
    expect(screen.getByTestId('zone-information').getAttribute('data-active')).toBe('true')
    expect(screen.getByTestId('zone-information').parentElement.hidden).toBe(false)
  })

  it('hands the form what the controller exposes, discard included', () => {
    renderZone(SAVED)
    expect(mocks.informationProps.zone).toEqual(SAVED)
    expect(mocks.informationProps).toHaveProperty('handleDiscardChanges')
    expect(mocks.informationProps).toHaveProperty('handleUpdateBusinessDeliveryZone')
    expect(mocks.informationProps).toHaveProperty('handleAddBusinessDeliveryZone')
  })
})

describe('Snooze', () => {
  it('opens the Snooze body in a dialog, with a close button', async () => {
    const { user } = renderZone(SAVED)
    expect(screen.queryByTestId('zone-snooze')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Snooze' }))
    const dialog = await screen.findByRole('dialog', { name: 'Snooze' })
    expect(within(dialog).getByTestId('zone-snooze')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('zone-snooze')).toBeNull())
  })
})

describe('Delete', () => {
  const openDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Zone actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('asks first, with the focus on Cancel, and does not delete until it is confirmed', async () => {
    const { user } = renderZone(SAVED)
    const dialog = await openDelete(user)
    expect(within(dialog).getByText('Are you sure that you want to delete this delivery zone?')).toBeTruthy()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDelete).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleDelete).not.toHaveBeenCalled()
  })

  // P6: DELETE /business/{store}/deliveryzones/{id} from a store that does not own the zone only unlinks it from that store
  it('says a zone shared by another store is removed from this store only', async () => {
    const shared = { id: 6, name: 'Midtown', business_id: 9, pivot: { business_id: 2 }, businesses: [{ id: 9 }, { id: 2 }] }
    const { user } = renderZone(shared)
    const dialog = await openDelete(user)
    expect(within(dialog).getByText('Midtown is shared by another store. It is removed from this store only; the other stores keep it.')).toBeTruthy()
    expect(within(dialog).queryByText('Are you sure that you want to delete this delivery zone?')).toBeNull()
  })

  it('keeps the usual question for a zone of this store, shared or not', async () => {
    const own = { id: 7, name: 'Uptown', business_id: 2, pivot: { business_id: 2 }, businesses: [{ id: 2 }, { id: 9 }] }
    const { user } = renderZone(own)
    const dialog = await openDelete(user)
    expect(within(dialog).getByText('Are you sure that you want to delete this delivery zone?')).toBeTruthy()
  })

  it('deletes the zone when it is confirmed', async () => {
    mocks.handleDelete.mockResolvedValue({ ok: true })
    const { user } = renderZone(SAVED)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete zone' }))
    expect(mocks.handleDelete).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('stays open and says why when the API refuses', async () => {
    mocks.handleDelete.mockResolvedValue({ ok: false, error: ['Zone in use'] })
    const { user } = renderZone(SAVED)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete zone' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Zone in use')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('says something went wrong when the API gave no message', async () => {
    mocks.handleDelete.mockResolvedValue({ ok: false })
    const { user } = renderZone(SAVED)
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete zone' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
  })
})
