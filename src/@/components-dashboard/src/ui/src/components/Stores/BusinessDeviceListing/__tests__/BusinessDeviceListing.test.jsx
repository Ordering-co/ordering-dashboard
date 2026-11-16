/* eslint-disable import/first */
// redesign stores devices (D1, D2 | G5-36, DV-02, DV-07): the list of /stores/devices on Product pieces beside the device
// panel. The controller (K/BusinessDeviceListing) is played by `Host` (it keeps the search and the list the way the real one does),
// and the panel (S/BusinessDeviceDetail) is a stub that records what it receives and plays the controller's answers (a delete, a
// create). The Product wrappers (PageHeader, FilterBar, SearchField, ColumnManager, DataTable, RecordCardList, SplitView, EmptyState)
// are the real ones. What is tested is what the page passes to the panel and what it owns: the rows, the URL, the guard, the focus.
import React, { useState } from 'react'
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ panel: null }))
const ctl = vi.hoisted(() => ({ devices: [], error: null, loading: false, panelDirty: false, pending: null, reload: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }],
  BusinessDeviceListing: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../BusinessDeviceDetail', async () => {
  const React = await import('react')
  return {
    BusinessDeviceDetail: (props) => {
      seen.panel = props
      // what RecordPanel does with `requestClose(proceed)`: ask when dirty, else go on
      const [asking, setAsking] = React.useState(false)
      React.useImperativeHandle(props.panelRef, () => ({
        requestClose: (proceed) => {
          const next = typeof proceed === 'function' ? proceed : props.onDismiss
          if (ctl.panelDirty) {
            ctl.pending = next
            setAsking(true)
          } else {
            next?.()
          }
        }
      }), [props.onDismiss])
      return (
        <div data-testid='device-panel'>
          <span>Panel of {props.selectedDevice ? props.selectedDevice.name : 'a new device'}</span>
          <span data-testid='panel-expanded'>{String(props.expanded)}</span>
          <button type='button' onClick={() => props.panelRef.current.requestClose()}>Close panel</button>
          <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand panel</button>
          <button
            type='button'
            onClick={() => {
              // the controller of the panel: it tells the list, then closes
              props.handleUpdateDeviceList(props.devices.filter(device => device.id !== props.selectedDevice.id))
              props.onClose()
            }}
          >
            Delete in panel
          </button>
          <button
            type='button'
            onClick={() => {
              const device = { id: 99, name: 'Brand new', code: 'NEW-99', business: { id: 1, name: 'Downtown' }, user: null, user_id: null }
              props.handleUpdateDeviceList([...props.devices, device])
              props.onCreated(device)
            }}
          >
            Create in panel
          </button>
          {asking && <button type='button' onClick={() => { const go = ctl.pending; ctl.pending = null; setAsking(false); go() }}>Discard in panel</button>}
        </div>
      )
    }
  }
})

import { BusinessDeviceListingUI } from '../index'

const downtown = { id: 1, name: 'Downtown', address: '1 Main St', logo: null, owners: [] }
const uptown = { id: 2, name: 'Uptown', address: '9 High Rd', logo: 'https://img/uptown.png', owners: [] }
const device = (id, name, business, user, extra = {}) => ({ id, name, code: `CODE-${id}`, business_id: business.id, business, user_id: user ? user.id : null, user, ...extra })
const ana = { id: 11, name: 'Ana', lastname: 'García' }
const bob = { id: 12, name: 'Bob', lastname: 'Stone' }
const DEVICES = [
  device(1, 'Till 1', downtown, ana),
  device(2, 'Till 2', uptown, bob),
  device(3, 'Kitchen screen', uptown, null)
]

const ROUTE = '/stores/devices'

// The controller: it keeps the search and the list, like K/BusinessDeviceListing
const Host = () => {
  const [search, setSearch] = useState(null)
  const [devices, setDevices] = useState(ctl.devices)
  return (
    <BusinessDeviceListingUI
      searchValue={search}
      onSearch={setSearch}
      deviceListState={{ loading: ctl.loading, devices, error: ctl.error }}
      handleUpdateDeviceList={setDevices}
      reloadDevices={ctl.reload}
    />
  )
}

let view
const renderPage = (route = ROUTE, devices = DEVICES, state = {}) => {
  window.history.replaceState(null, '', route)
  ctl.devices = devices
  ctl.error = state.error ?? null
  ctl.loading = state.loading ?? false
  view = renderWithProviders(<Host />, { initialEntries: [route] })
  return view
}

const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))
const table = () => screen.getByRole('table', { name: 'Devices' })
const rowOf = (name) => within(table()).getByText(name).closest('tr')

// jsdom answers matchMedia with `matches: false`: one that evaluates (min|max)-width against a width is installed
// (1440: the split mode, the panel beside the list; 500: a phone)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

let restoreViewport
beforeEach(() => {
  window.localStorage.clear()
  restoreViewport = installViewport(1440)
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  ctl.panelDirty = false
  ctl.pending = null
  ctl.reload = vi.fn()
  seen.panel = null
})

afterEach(() => {
  cleanup()
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

describe('the header and the table', () => {
  it('draws the title with the count, Add new device, the search, the columns and one row per device', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /Devices/ })).toBeInTheDocument()
    expect(screen.getByText('3 devices')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add new device' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Manage columns' })).toBeInTheDocument()
    ;['Device', 'Store', 'Owner'].forEach(name => expect(within(table()).getByRole('columnheader', { name })).toBeInTheDocument())
    expect(within(table()).getAllByRole('row')).toHaveLength(1 + DEVICES.length)
  })

  it('shows the store with its address and the owner by name, or «No owner» when there is none', () => {
    renderPage()
    expect(within(rowOf('Till 1')).getByText('Downtown')).toBeInTheDocument()
    expect(within(rowOf('Till 1')).getByText('1 Main St')).toBeInTheDocument()
    expect(within(rowOf('Till 1')).getByText('Ana García')).toBeInTheDocument()
    expect(within(rowOf('Kitchen screen')).getByText('No owner')).toBeInTheDocument()
  })

  it('says «No owner» for a device whose owner the API no longer returns (user_id set, user null)', () => {
    renderPage(ROUTE, [device(5, 'Orphan', downtown, null, { user_id: 77 })])
    expect(within(rowOf('Orphan')).getByText('No owner')).toBeInTheDocument()
  })

  it('draws no count while it loads and the skeleton rows say so', () => {
    renderPage(ROUTE, [], { loading: true })
    expect(screen.queryByText(/^\d+ devices?$/)).toBeNull()
    expect(table()).toHaveAttribute('aria-busy', 'true')
  })

  it('has the menu button only while the sidebar is collapsed', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    cleanup()
    infoShare.isCollapse = true
    renderPage()
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('hides a column with the column manager; Device is locked (n.º 13, stores-devices PP-1)', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog')
    const device = within(dialog).getByRole('checkbox', { name: /Device/ })
    expect(device).toBeDisabled()
    expect(device.closest('li')).toHaveTextContent('Always shown')
    expect(within(dialog).getAllByText('Always shown')).toHaveLength(1)
    await userEvent.click(device)
    expect(within(table()).getByRole('columnheader', { name: 'Device' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Owner/ }))
    expect(within(table()).queryByRole('columnheader', { name: 'Owner' })).toBeNull()
    expect(within(table()).getByRole('columnheader', { name: 'Device' })).toBeInTheDocument()
  })
})

describe('search (T7)', () => {
  it('filters by the name, the store, the owner and the code in the browser', async () => {
    renderPage()
    const box = screen.getByRole('searchbox', { name: 'Search' })
    await userEvent.type(box, 'uptown')
    expect(within(table()).queryByText('Till 1')).toBeNull()
    expect(within(table()).getByText('Till 2')).toBeInTheDocument()
    expect(within(table()).getByText('Kitchen screen')).toBeInTheDocument()
    await userEvent.clear(box)
    await userEvent.type(box, 'garcia')
    expect(within(table()).getAllByRole('row')).toHaveLength(2)
    expect(within(table()).getByText('Till 1')).toBeInTheDocument()
    await userEvent.clear(box)
    await userEvent.type(box, 'code-3')
    expect(within(table()).getAllByRole('row')).toHaveLength(2)
    expect(within(table()).getByText('Kitchen screen')).toBeInTheDocument()
  })

  it('a text that is not data («No owner») matches nothing', async () => {
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'No owner')
    expect(screen.getByText('No devices match')).toBeInTheDocument()
  })
})

describe('empty, no results and error', () => {
  it('no devices: «No devices yet» with an Add action that opens the panel for a new device', async () => {
    renderPage(ROUTE, [])
    expect(screen.getByText('No devices yet')).toBeInTheDocument()
    expect(screen.getByText('0 devices')).toBeInTheDocument()
    // the action of the empty state is the only «Add new device» that is not the header's or the foot's
    await userEvent.click(screen.getByText('Add new device', { selector: '.odc-empty button, .odc-empty-action button, [class*="empty"] button' }))
    expect(await screen.findByText('Panel of a new device')).toBeInTheDocument()
    expect(seen.panel.selectedDevice).toBeNull()
  })

  it('a search with no results: «No devices match» and Clear search brings the list back', async () => {
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz')
    expect(screen.getByText('No devices match')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Clear search', { selector: 'button' }))
    await waitFor(() => expect(within(table()).getAllByRole('row')).toHaveLength(1 + DEVICES.length))
  })

  it('a failed load: the message in an alert and Retry calls reloadDevices', async () => {
    renderPage(ROUTE, [], { error: ['The server is on fire'] })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText("We couldn't load the devices.")).toBeInTheDocument()
    expect(within(alert).getByText('The server is on fire')).toBeInTheDocument()
    expect(screen.queryByText('No devices yet')).toBeNull()
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(ctl.reload).toHaveBeenCalledTimes(1)
  })

  // J2 row 17 (stores-devices PP-2): the repeated «Add new device» at the foot is gone; the header's stays
  it('has no «Add new device» at the foot of the list; the header\'s opens a new device', async () => {
    renderPage()
    expect(document.querySelector('.odc-dv-foot')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add new device' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Add new device' }))
    expect(await screen.findByText('Panel of a new device')).toBeInTheDocument()
  })
})

describe('the panel and the URL (G5-36)', () => {
  it('opening a row opens the panel with that device, marks the row and writes ?id=', async () => {
    renderPage()
    await userEvent.click(within(table()).getByText('Till 2'))
    expect(await screen.findByText('Panel of Till 2')).toBeInTheDocument()
    expect(seen.panel.selectedDevice).toBe(DEVICES[1])
    expect(rowOf('Till 2')).toHaveAttribute('aria-current', 'true')
    expect(urlParams()).toEqual({ id: '2' })
  })

  it('mounts the panel again for each device and for «Add» (DV-08): the key follows the device', async () => {
    renderPage()
    await userEvent.click(within(table()).getByText('Till 1'))
    const first = await screen.findByTestId('device-panel')
    await userEvent.click(within(table()).getByText('Till 2'))
    await screen.findByText('Panel of Till 2')
    expect(screen.getByTestId('device-panel')).not.toBe(first)
    const second = screen.getByTestId('device-panel')
    await userEvent.click(screen.getAllByRole('button', { name: 'Add new device' })[0])
    await screen.findByText('Panel of a new device')
    expect(screen.getByTestId('device-panel')).not.toBe(second)
    expect(urlParams()).toEqual({})
  })

  it('closing the panel removes ?id= and gives the focus back to the row', async () => {
    renderPage()
    await userEvent.click(within(table()).getByText('Till 2'))
    await userEvent.click(await screen.findByRole('button', { name: 'Close panel' }))
    expect(screen.queryByTestId('device-panel')).toBeNull()
    expect(urlParams()).toEqual({})
    await waitFor(() => expect(rowOf('Till 2').contains(document.activeElement)).toBe(true))
  })

  it('loading the page with ?id= opens that device once the list is in', async () => {
    renderPage(`${ROUTE}?id=2`)
    expect(await screen.findByText('Panel of Till 2')).toBeInTheDocument()
    expect(urlParams()).toEqual({ id: '2' })
  })

  it('does not decide on ?id= while the list loads', () => {
    renderPage(`${ROUTE}?id=2`, [], { loading: true })
    expect(screen.queryByTestId('device-panel')).toBeNull()
    expect(urlParams()).toEqual({ id: '2' })
  })

  it('removes an ?id= that is not in the list, but only when the list has devices', () => {
    renderPage(`${ROUTE}?id=404`)
    expect(screen.queryByTestId('device-panel')).toBeNull()
    expect(urlParams()).toEqual({})
    cleanup()
    renderPage(`${ROUTE}?id=404`, [])
    expect(urlParams()).toEqual({ id: '404' })
    cleanup()
    renderPage(`${ROUTE}?id=404`, [], { error: ['boom'] })
    expect(urlParams()).toEqual({ id: '404' })
  })

  it('keeps the other parameters of the address', async () => {
    renderPage(`${ROUTE}?foo=bar`)
    await userEvent.click(within(table()).getByText('Till 1'))
    await screen.findByTestId('device-panel')
    expect(urlParams()).toEqual({ foo: 'bar', id: '1' })
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(urlParams()).toEqual({ foo: 'bar' })
  })

  it('gives the panel the list, the callback that updates it and the open / expand state', async () => {
    renderPage()
    await userEvent.click(within(table()).getByText('Till 1'))
    await screen.findByTestId('device-panel')
    expect(seen.panel.devices).toHaveLength(3)
    expect(typeof seen.panel.handleUpdateDeviceList).toBe('function')
    expect(seen.panel.expanded).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Expand panel' }))
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('true')
  })
})

describe('the discard guard', () => {
  it('changing row with unsaved changes asks first and only goes on when the changes are discarded', async () => {
    renderPage()
    await userEvent.click(within(table()).getByText('Till 1'))
    await screen.findByText('Panel of Till 1')
    ctl.panelDirty = true
    await userEvent.click(within(table()).getByText('Till 2'))
    expect(screen.getByText('Panel of Till 1')).toBeInTheDocument()
    expect(urlParams()).toEqual({ id: '1' })
    await userEvent.click(screen.getByRole('button', { name: 'Discard in panel' }))
    expect(await screen.findByText('Panel of Till 2')).toBeInTheDocument()
    expect(urlParams()).toEqual({ id: '2' })
  })

  it('«Add new device» over a dirty panel asks first too', async () => {
    renderPage()
    await userEvent.click(within(table()).getByText('Till 1'))
    await screen.findByText('Panel of Till 1')
    ctl.panelDirty = true
    await userEvent.click(screen.getAllByRole('button', { name: 'Add new device' })[0])
    expect(screen.getByText('Panel of Till 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Discard in panel' }))
    expect(await screen.findByText('Panel of a new device')).toBeInTheDocument()
  })
})

describe('after the panel creates or deletes', () => {
  it('after creating (D3) the list opens that device and writes ?id=', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Add new device' })[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Create in panel' }))
    expect(await screen.findByText('Panel of Brand new')).toBeInTheDocument()
    expect(urlParams()).toEqual({ id: '99' })
    expect(rowOf('Brand new')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('4 devices')).toBeInTheDocument()
  })

  it('after deleting, the panel closes, ?id= goes and the focus lands on the next row', async () => {
    renderPage()
    await userEvent.click(within(table()).getByText('Till 2'))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete in panel' }))
    expect(screen.queryByTestId('device-panel')).toBeNull()
    expect(urlParams()).toEqual({})
    expect(within(table()).queryByText('Till 2')).toBeNull()
    await waitFor(() => expect(rowOf('Kitchen screen').contains(document.activeElement)).toBe(true))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('deleting the last device of all leaves the list empty (DV-02)', async () => {
    renderPage(ROUTE, [DEVICES[0]])
    await userEvent.click(within(table()).getByText('Till 1'))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete in panel' }))
    expect(await screen.findByText('No devices yet')).toBeInTheDocument()
    expect(within(table()).queryByText('Till 1')).toBeNull()
    expect(urlParams()).toEqual({})
  })

  it('deleting while a search matches only that device shows «No devices match», not a stale row', async () => {
    renderPage()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'kitchen')
    await userEvent.click(within(table()).getByText('Kitchen screen'))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete in panel' }))
    expect(await screen.findByText('No devices match')).toBeInTheDocument()
  })
})

describe('phone (DV-07)', () => {
  beforeEach(() => {
    restoreViewport()
    restoreViewport = installViewport(500)
  })

  it('draws cards instead of the table: the name and one «store · owner» line', () => {
    renderPage()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Devices' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(within(cards[0]).getByRole('link', { name: 'Open Till 1' })).toHaveTextContent('Till 1')
    expect(cards[0]).toHaveTextContent('Downtown · Ana García')
    expect(cards[2]).toHaveTextContent('Uptown · No owner')
  })

  it('opening a card opens the panel and writes ?id=', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('link', { name: 'Open Till 2' }))
    expect(await screen.findByText('Panel of Till 2')).toBeInTheDocument()
    expect(urlParams()).toEqual({ id: '2' })
  })

  it('has the empty states too', async () => {
    renderPage(ROUTE, [])
    expect(screen.getByText('No devices yet')).toBeInTheDocument()
    await act(async () => {})
  })
})
