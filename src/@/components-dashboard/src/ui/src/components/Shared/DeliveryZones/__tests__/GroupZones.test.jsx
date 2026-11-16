/* eslint-disable import/first */
// redesign DG-B2c (decision 3 | M-DG6, M-DG25, M-DG38): the delivery zones section of the group panel. The controller is the real
// K/DriverGroupDeliveryDetails (with `fetch` simulated), so the contract of lot B1 (`{ ok, error }`, `reloadZones`, `resetZoneState`)
// is the one the section really gets. The overview map, the zone editor (lot B2b), the Google loader and the phone flag are
// simulated; the Product wrappers (MapFrame, DataTable, RecordCardList, SaveBar, ConfirmDialog, EmptyState) are the real ones.
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  phone: false,
  sdkStatus: 'ready',
  sdk: vi.fn(),
  mapProps: null,
  mapMounts: 0,
  mapUnmounts: 0,
  editorProps: null,
  editorMounts: 0,
  configs: { google_maps_api_key: { value: 'KEY' } }
}))

vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => {
  const ordering = { root: 'https://api.test' }
  return { useApi: () => [ordering] }
})
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { DriverGroupDeliveryDetails } = await import('../../../../../../components/DriverGroupDeliveryDetails')
  return {
    DriverGroupDeliveryDetails,
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useConfig: () => [{ configs: mocks.configs }],
    useUtils: () => [{ parsePrice: value => `$ ${Number(value).toFixed(2)}` }]
  }
})
vi.mock('../../../../hooks/useGoogleMapsSdk', () => ({
  useGoogleMapsSdk: (apiKey) => {
    mocks.sdk(apiKey)
    return { status: mocks.sdkStatus, generation: 0 }
  }
}))
vi.mock('../../Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))
vi.mock('../ZonesOverviewMap', async () => {
  const React = await import('react')
  return {
    ZonesOverviewMap: (props) => {
      mocks.mapProps = props
      React.useEffect(() => {
        mocks.mapMounts += 1
        return () => { mocks.mapUnmounts += 1 }
      }, [])
      return (
        <div data-testid='overview-map'>
          <button type='button' onClick={() => props.onSelect(12)}>shape of Ring</button>
        </div>
      )
    }
  }
})
vi.mock('../../../Delivery/DriversGroupsDeliveryZoneDetails', async () => {
  const React = await import('react')
  return {
    DriverGroupDeliveryZoneDetails: (props) => {
      mocks.editorProps = props
      React.useEffect(() => { mocks.editorMounts += 1 }, [])
      return (
        <div data-testid='zone-editor'>
          <button type='button' onClick={props.onBack}>back to all zones</button>
          <button type='button' onClick={() => props.onDirtyChange?.(true)}>make the form dirty</button>
          <button type='button' onClick={() => props.onDirtyChange?.(false)}>make the form clean</button>
          <button type='button' onClick={() => props.onClose()}>zone saved</button>
        </div>
      )
    }
  }
})

import { GroupZones } from '../GroupZones'

const GROUP = {
  id: 4,
  name: 'North',
  business: [{ id: 1, name: 'Shop', location: { lat: 41, lng: -73 } }]
}
const ZONES = () => ([
  { id: 11, name: 'Centre', type: 1, enabled: true, minimum: 10, price: 2.5, data: { center: { lat: 41, lng: -73 }, radio: 2 } },
  { id: 12, name: 'Ring', type: 2, enabled: false, minimum: 0, price: 5, data: [] },
  { id: 13, name: 'Whole city', type: 4, enabled: true, minimum: 20, price: 7, data: {} },
  { id: 14, name: 'Near stores', type: 5, enabled: true, minimum: 5, price: 1, data: { distance: '3', unit: 'km' } },
  { id: 15, name: 'Legacy', type: 3, enabled: true, minimum: 1, price: 1, data: {} }
])
const DISCARD = {
  discardTitle: 'Discard your changes?',
  discardDescription: 'What you changed here is not saved yet.',
  discardConfirmLabel: 'Discard',
  keepEditingLabel: 'Keep editing'
}

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const zonesUrl = 'https://api.test/drivergroups/4/deliveryzones'
const puts = () => mocks.fetch.mock.calls.filter(([, options]) => options?.method === 'PUT')

let onDirtyChange
const draw = async (props = {}, { wait = true } = {}) => {
  onDirtyChange = vi.fn()
  const view = render(<GroupZones drivergroup={GROUP} discardTexts={DISCARD} onDirtyChange={onDirtyChange} actionDisabled={false} {...props} />)
  // the zones have arrived when nothing is busy any more
  if (wait) await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull())
  return view
}
const rowOf = (id) => document.querySelector(`tr[data-row-id="${id}"]`)
const checkboxOf = (id) => within(rowOf(id)).getByRole('checkbox')
const lastDirty = () => onDirtyChange.mock.calls.at(-1)?.[0]

class FakeResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.phone = false
  mocks.sdkStatus = 'ready'
  mocks.sdk.mockClear()
  mocks.mapProps = null
  mocks.mapMounts = 0
  mocks.mapUnmounts = 0
  mocks.editorProps = null
  mocks.editorMounts = 0
  mocks.configs = { google_maps_api_key: { value: 'KEY' } }
  mocks.fetch.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (options?.method === 'PUT') return json({ error: false, result: {} })
    return json({ error: false, result: ZONES() })
  })
  globalThis.fetch = mocks.fetch
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('GroupZones · the map (decision 3)', () => {
  it('asks the zones of the group and draws the overview map inside a MapFrame named after the group', async () => {
    await draw()
    expect(mocks.fetch).toHaveBeenCalledWith(zonesUrl, expect.objectContaining({ method: 'GET' }))
    const frame = screen.getByRole('region', { name: 'Delivery zones of North' })
    expect(frame).toHaveClass('odc-map-frame')
    expect(frame).toHaveAttribute('data-size', 'default')
    expect(within(frame).getByTestId('overview-map')).toBeInTheDocument()
  })

  it('gives the map the zones without the legacy type 3, the stores of the group, a label and the Google key of the project', async () => {
    await draw()
    expect(mocks.sdk).toHaveBeenCalledWith('KEY')
    expect(mocks.mapProps.zones.map(zone => zone.id)).toEqual([11, 12, 13, 14])
    expect(mocks.mapProps.businesses).toEqual(GROUP.business)
    expect(mocks.mapProps.label).toBe('Delivery zones of North')
    expect(mocks.mapProps.selectedId).toBeUndefined()
  })

  // redesign DS-B0: promoted to Shared/DeliveryZones, the host names the group and gives the guard's texts
  it('names the map after the `name` the host gives, over the group\'s own name', async () => {
    await draw({ name: '  Uber   Direct ' })
    expect(screen.getByRole('region', { name: 'Delivery zones of Uber Direct' })).toBeInTheDocument()
    expect(mocks.mapProps.label).toBe('Delivery zones of Uber Direct')
  })

  it('needs the texts of the discard guard from its host', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<GroupZones drivergroup={GROUP} onDirtyChange={vi.fn()} actionDisabled={false} />)).toThrow('GroupZones needs discardTexts')
    quiet.mockRestore()
  })

  it('does not draw the map until the SDK is ready', async () => {
    mocks.sdkStatus = 'loading'
    await draw()
    expect(screen.getByRole('region', { name: 'Delivery zones of North' })).toBeInTheDocument()
    expect(screen.queryByTestId('overview-map')).toBeNull()
    expect(screen.getByRole('table', { name: 'Delivery zones' })).toBeInTheDocument()
  })

  it('says «Map unavailable» when the SDK fails and the list stays usable', async () => {
    mocks.sdkStatus = 'error'
    await draw()
    const frame = screen.getByRole('region', { name: 'Delivery zones of North' })
    expect(frame).toHaveAttribute('data-state', 'unavailable')
    expect(within(frame).getByText('Map unavailable')).toBeInTheDocument()
    expect(within(frame).getByText('The zones are still listed below and can be edited.')).toBeInTheDocument()
    expect(screen.queryByTestId('overview-map')).toBeNull()
    expect(checkboxOf(11)).toBeEnabled()
  })

  it('says the same with no Google key', async () => {
    mocks.configs = {}
    mocks.sdkStatus = 'error'
    await draw()
    expect(mocks.sdk).toHaveBeenCalledWith(undefined)
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
  })

  it('is compact on a phone', async () => {
    mocks.phone = true
    await draw()
    expect(screen.getByRole('region', { name: 'Delivery zones of North' })).toHaveAttribute('data-size', 'compact')
  })

  it('names, in one line each, the active zones that cover everywhere (type 4 draws nothing)', async () => {
    await draw()
    expect(screen.getByText('Whole city covers everywhere.')).toBeInTheDocument()
  })

  it('does not say it for an everywhere zone that is unchecked', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(checkboxOf(13))
    expect(screen.queryByText('Whole city covers everywhere.')).toBeNull()
  })
})

describe('GroupZones · the list', () => {
  it('has Active, Zone, Type, Minimum and Fee, one row per zone and no legacy type 3', async () => {
    await draw()
    const table = screen.getByRole('table', { name: 'Delivery zones' })
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Active', 'Zone', 'Type', 'Minimum', 'Fee'])
    expect(Array.from(document.querySelectorAll('tbody tr[data-row-id]')).map(row => row.getAttribute('data-row-id'))).toEqual(['11', '12', '13', '14'])
    expect(screen.queryByText('Legacy')).toBeNull()
  })

  it('shows the type, the distance of a distance-based zone and the money as figures', async () => {
    await draw()
    expect(rowOf(11)).toHaveTextContent('Circle')
    expect(rowOf(12)).toHaveTextContent('Polygon')
    expect(rowOf(13)).toHaveTextContent('Everywhere')
    const distance = rowOf(14)
    expect(distance).toHaveTextContent('Distance based · 3 km')
    expect(within(distance).getByText('3 km')).toHaveClass('odc-figure')
    // Minimum and Fee: the project's currency format, in a figure
    expect(within(rowOf(11)).getByText('$ 10.00')).toHaveClass('odc-figure')
    expect(within(rowOf(11)).getByText('$ 2.50')).toHaveClass('odc-figure')
  })

  it('the zone name is a button that opens the editor', async () => {
    await draw()
    expect(within(rowOf(11)).getByRole('button', { name: 'Centre' })).toBeInTheDocument()
  })

  it('shows a skeleton while the zones load and never the empty state before the request starts', async () => {
    mocks.fetch.mockImplementation(() => new Promise(() => {}))
    await draw({}, { wait: false })
    expect(screen.queryByText('No delivery zones yet')).toBeNull()
    expect(document.querySelector('[data-skeleton]')).not.toBeNull()
  })
})

describe('GroupZones · Active and Save', () => {
  it('the Active boxes show the stored state and the header says «Select all»', async () => {
    await draw()
    expect(checkboxOf(11)).toBeChecked()
    expect(checkboxOf(12)).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).not.toBeChecked()
  })

  it('a box changes the pending state and the bar counts it, with the name of the zone', async () => {
    const user = userEvent.setup()
    await draw()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    await user.click(checkboxOf(12))
    expect(checkboxOf(12)).toBeChecked()
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar).toHaveTextContent('1 unsaved change · Ring')
    expect(within(bar).getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
  })

  it('checking a box and then unchecking it leaves no change', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(checkboxOf(12))
    await user.click(checkboxOf(12))
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    expect(lastDirty()).toBe(false)
  })

  it('«Select all» checks every zone', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    for (const id of [11, 12, 13, 14]) expect(checkboxOf(id)).toBeChecked()
    expect(screen.getByRole('group', { name: 'Save changes' })).toHaveTextContent('1 unsaved change · Ring')
  })

  it('Save sends only the zones that changed and the bar says «Saved»', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(checkboxOf(12))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][0]).toBe(`${zonesUrl}/12`)
    expect(JSON.parse(puts()[0][1].body)).toEqual({ enabled: true })
    expect(await screen.findByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(lastDirty()).toBe(false)
  })

  it('a failed save says so in the bar, keeps the pending change and the answer is `{ ok: false }`', async () => {
    const user = userEvent.setup()
    mocks.fetch.mockImplementation((url, options) => {
      if (options?.method === 'PUT') return json({ error: true, result: 'Zone is locked' })
      return json({ error: false, result: ZONES() })
    })
    await draw()
    await user.click(checkboxOf(12))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("We couldn't save the zones. Zone is locked")
    expect(checkboxOf(12)).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(lastDirty()).toBe(true)
  })

  it('Discard puts the boxes back (resetZoneState) and clears the bar', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(checkboxOf(12))
    await user.click(checkboxOf(11))
    expect(screen.getByRole('group', { name: 'Save changes' })).toHaveTextContent('2 unsaved changes')
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(checkboxOf(12)).not.toBeChecked()
    expect(checkboxOf(11)).toBeChecked()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
    expect(puts()).toHaveLength(0)
  })
})

describe('GroupZones · the editor replaces the list', () => {
  it('a zone opens the editor in place of the list and the map; the editor gets the props of the old list', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    expect(screen.getByTestId('zone-editor')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByTestId('overview-map')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Delivery zones of North' })).toBeNull()
    const props = mocks.editorProps
    expect(props.zone.id).toBe(11)
    expect(props.drivergroup).toBe(GROUP)
    expect(props.driverGroupsZones.zones).toHaveLength(5)
    expect(props.setZoneList).toBeInstanceOf(Function)
    expect(props.onClose).toBeInstanceOf(Function)
    expect(props.onBack).toBeInstanceOf(Function)
    expect(props.onDirtyChange).toBeInstanceOf(Function)
  })

  it('the overview map and the editor are never mounted at the same time', async () => {
    const user = userEvent.setup()
    await draw()
    expect(mocks.mapMounts).toBe(1)
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    expect(mocks.mapUnmounts).toBe(1)
    expect(mocks.editorMounts).toBe(1)
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    expect(screen.queryByTestId('zone-editor')).toBeNull()
    expect(mocks.mapMounts).toBe(2)
  })

  // redesign DG-R1 (R1-04): opening the editor moves the focus into it, to «← All zones», not leaves it on the panel
  it('R1-04: opening a zone puts the focus on «← All zones»; going back puts it on the zone', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    expect(screen.getByRole('button', { name: 'back to all zones' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    expect(within(rowOf(11)).getByRole('button', { name: 'Centre' })).toHaveFocus()
  })

  it('R1-04: «Add delivery zone» puts the focus on «← All zones» too, and the keyboard opens a zone the same way', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(screen.getByRole('button', { name: 'Add delivery zone' }))
    expect(screen.getByRole('button', { name: 'back to all zones' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    act(() => { rowOf(13).focus() })
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'back to all zones' })).toHaveFocus()
  })

  it('a click on the row (outside the controls) opens it too', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(12)).getByText('Polygon'))
    expect(mocks.editorProps.zone.id).toBe(12)
  })

  it('Enter on a focused row opens it', async () => {
    const user = userEvent.setup()
    await draw()
    act(() => { rowOf(13).focus() })
    await user.keyboard('{Enter}')
    expect(mocks.editorProps.zone.id).toBe(13)
  })

  it('a click on an Active box does not open the zone', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(checkboxOf(11))
    expect(screen.queryByTestId('zone-editor')).toBeNull()
  })

  it('«Add delivery zone» opens the editor with no zone', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(screen.getByRole('button', { name: 'Add delivery zone' }))
    expect(screen.getByTestId('zone-editor')).toBeInTheDocument()
    expect(mocks.editorProps.zone).toBeNull()
  })

  it('«← All zones» with a clean form goes back at once and the focus returns to the zone', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(12)).getByRole('button', { name: 'Ring' }))
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('table', { name: 'Delivery zones' })).toBeInTheDocument()
    expect(within(rowOf(12)).getByRole('button', { name: 'Ring' })).toHaveFocus()
  })

  it('saving the zone (the editor calls onClose) goes back to the list', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    await user.click(screen.getByRole('button', { name: 'zone saved' }))
    expect(screen.queryByTestId('zone-editor')).toBeNull()
    expect(within(rowOf(11)).getByRole('button', { name: 'Centre' })).toHaveFocus()
  })

  it('after adding a zone the focus goes to «Add delivery zone»', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(screen.getByRole('button', { name: 'Add delivery zone' }))
    await user.click(screen.getByRole('button', { name: 'zone saved' }))
    expect(screen.getByRole('button', { name: 'Add delivery zone' })).toHaveFocus()
  })

  it('has no Escape of its own: Esc leaves the editor open', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    await user.keyboard('{Escape}')
    expect(screen.getByTestId('zone-editor')).toBeInTheDocument()
  })
})

describe('GroupZones · the guard of «← All zones»', () => {
  it('with the form dirty it asks first, with the four texts of the panel and the focus on «Keep editing»', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    await user.click(screen.getByRole('button', { name: 'make the form dirty' }))
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus())
    expect(screen.getByTestId('zone-editor')).toBeInTheDocument()
  })

  it('«Keep editing» stays in the editor', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    await user.click(screen.getByRole('button', { name: 'make the form dirty' }))
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('zone-editor')).toBeInTheDocument()
  })

  it('«Discard» goes back to the list', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    await user.click(screen.getByRole('button', { name: 'make the form dirty' }))
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(screen.queryByTestId('zone-editor')).toBeNull()
    expect(screen.getByRole('table', { name: 'Delivery zones' })).toBeInTheDocument()
    expect(lastDirty()).toBe(false)
  })

  it('a form that went clean again does not ask', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    await user.click(screen.getByRole('button', { name: 'make the form dirty' }))
    await user.click(screen.getByRole('button', { name: 'make the form clean' }))
    await user.click(screen.getByRole('button', { name: 'back to all zones' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('table', { name: 'Delivery zones' })).toBeInTheDocument()
  })
})

describe('GroupZones · onDirtyChange toward the panel', () => {
  it('is false on mount, true with an unsaved box and false again after Discard', async () => {
    const user = userEvent.setup()
    await draw()
    expect(lastDirty()).toBe(false)
    await user.click(checkboxOf(12))
    expect(lastDirty()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(lastDirty()).toBe(false)
  })

  it('is true while the form of the open zone is dirty', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    expect(lastDirty()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'make the form dirty' }))
    expect(lastDirty()).toBe(true)
  })

  it('stays true with the unsaved boxes while the editor is open', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(checkboxOf(12))
    await user.click(within(rowOf(11)).getByRole('button', { name: 'Centre' }))
    expect(lastDirty()).toBe(true)
  })

  it('says false when the section goes away', async () => {
    const user = userEvent.setup()
    const { unmount } = await draw()
    await user.click(checkboxOf(12))
    expect(lastDirty()).toBe(true)
    unmount()
    expect(lastDirty()).toBe(false)
  })
})

describe('GroupZones · the map and the list talk', () => {
  it('a focused row is the selected zone of the map', async () => {
    await draw()
    act(() => { rowOf(12).focus() })
    expect(mocks.mapProps.selectedId).toBe(12)
    expect(rowOf(12)).toHaveAttribute('data-active')
  })

  it('a click on a shape selects its zone and focuses its row', async () => {
    const user = userEvent.setup()
    await draw()
    await user.click(screen.getByRole('button', { name: 'shape of Ring' }))
    expect(mocks.mapProps.selectedId).toBe(12)
    expect(rowOf(12)).toHaveFocus()
  })
})

describe('GroupZones · empty and error', () => {
  it('with no zones: «No delivery zones yet» and «Add delivery zone», no table, no header box and no map', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [] }))
    const user = userEvent.setup()
    await draw()
    expect(screen.getByText('No delivery zones yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByTestId('overview-map')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add delivery zone' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Add delivery zone' }))
    expect(mocks.editorProps.zone).toBeNull()
  })

  it('with only a legacy zone (type 3) it is empty as well', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [{ id: 15, name: 'Legacy', type: 3, enabled: true }] }))
    await draw()
    expect(screen.getByText('No delivery zones yet')).toBeInTheDocument()
  })

  it('a load error is an alert with «Retry» that asks again (reloadZones); there is no Add on it', async () => {
    const user = userEvent.setup()
    mocks.fetch.mockImplementationOnce(() => json({ error: true, result: ['Not allowed'] }))
    await draw()
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText("We couldn't load the delivery zones.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add delivery zone' })).toBeNull()
    expect(screen.queryByTestId('overview-map')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: 'Delivery zones' })).toBeInTheDocument()
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === 'GET')).toHaveLength(2)
  })
})

describe('GroupZones · actionDisabled (M-DG6)', () => {
  it('really disables the boxes, the header box, the zone buttons and Add', async () => {
    await draw({ actionDisabled: true })
    const names = { 11: 'Centre', 12: 'Ring', 13: 'Whole city', 14: 'Near stores' }
    for (const [id, name] of Object.entries(names)) {
      expect(checkboxOf(id)).toBeDisabled()
      expect(within(rowOf(id)).getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add delivery zone' })).toBeDisabled()
  })

  it('does not open a zone from the row', async () => {
    const user = userEvent.setup()
    await draw({ actionDisabled: true })
    await user.click(within(rowOf(12)).getByText('Polygon'))
    expect(screen.queryByTestId('zone-editor')).toBeNull()
  })

  // P/SaveBar has no `disabled`: the bar is inert (out of reach of pointer and keyboard), as the panel does with a section
  it('puts Save and Discard of a pending change out of reach (inert)', async () => {
    const view = await draw()
    const user = userEvent.setup()
    await user.click(checkboxOf(12))
    expect(screen.getByRole('button', { name: 'Save' }).closest('[inert]')).toBeNull()
    view.rerender(<GroupZones drivergroup={GROUP} discardTexts={DISCARD} onDirtyChange={onDirtyChange} actionDisabled />)
    const inert = screen.getByRole('button', { name: 'Save' }).closest('[inert]')
    expect(inert).not.toBeNull()
    expect(inert).toHaveAttribute('aria-disabled', 'true')
    expect(inert).toContainElement(screen.getByRole('button', { name: 'Discard' }))
  })

  it('disables Add on the empty state', async () => {
    mocks.fetch.mockImplementation(() => json({ error: false, result: [] }))
    await draw({ actionDisabled: true })
    expect(screen.getByRole('button', { name: 'Add delivery zone' })).toBeDisabled()
  })
})

describe('GroupZones · phone', () => {
  it('draws cards that keep their Active box, and Add stays visible', async () => {
    mocks.phone = true
    const user = userEvent.setup()
    await draw()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Delivery zones' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    const card = list.querySelector('li[data-row-id="12"]')
    expect(card).toHaveTextContent('Ring')
    expect(card).toHaveTextContent('Polygon')
    const box = within(card.querySelector('[data-card-actions]')).getByRole('checkbox', { name: 'Active' })
    expect(box).not.toBeChecked()
    await user.click(box)
    expect(box).toBeChecked()
    expect(screen.getByRole('group', { name: 'Save changes' })).toHaveTextContent('1 unsaved change · Ring')
    expect(screen.getByRole('button', { name: 'Add delivery zone' })).toBeInTheDocument()
  })

  it('«Select all» of the cards checks every zone', async () => {
    mocks.phone = true
    const user = userEvent.setup()
    await draw()
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    for (const id of [11, 12, 13, 14]) {
      expect(within(document.querySelector(`li[data-row-id="${id}"]`)).getByRole('checkbox', { name: 'Active' })).toBeChecked()
    }
  })

  it('a card opens the editor', async () => {
    mocks.phone = true
    const user = userEvent.setup()
    await draw()
    await user.click(within(document.querySelector('li[data-row-id="11"]')).getByRole('link', { name: 'Centre' }))
    expect(mocks.editorProps.zone.id).toBe(11)
  })
})
