/* eslint-disable import/first */
// redesign DG-B4 (decision 1 | auditor 5): the opt-in `inline` prop of DriversGroupLogistics. The three sub-panels (Group orders,
// Autoassign settings, Mark drivers as busy) are drawn inside the section, in place of the list of entries, with «← Advanced logistics»
// to go back; no SideBar, no Modal, and the parent side bar is never moved. Without `inline` it is the component of main.
import React from 'react'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ width: 1400, addQueryToUrl: vi.fn(), removeQueryToUrl: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => fallback || key]
}))

vi.mock('../../../Shared', () => ({
  SideBar: ({ children }) => <div data-testid='sidebar'>{children}</div>,
  Modal: ({ children }) => <div data-testid='modal'>{children}</div>
}))
vi.mock('../../../../styles', () => ({ Button: ({ children, borderRadius: _borderRadius, color: _color, ...props }) => <button {...props}>{children}</button> }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: mocks.width }) }))
vi.mock('../../../../utils', () => ({ addQueryToUrl: mocks.addQueryToUrl, removeQueryToUrl: mocks.removeQueryToUrl }))
vi.mock('../../DriversGroupOrders', () => ({ DriversGroupOrders: () => <div>Group orders panel</div> }))
vi.mock('../../DriversGroupAutoassign', () => ({ DriversGroupAutoassign: () => <div>Autoassign panel</div> }))
vi.mock('../../DriversMarkAsBusy', () => ({ DriversMarkAsBusy: () => <div>Mark busy panel</div> }))

import { DriversGroupLogistics } from '..'

let handleParentSidebarMove
let handleUpdateDriversGroup
// redesign DG-R1 (R1-03): inline reads `?config=` from the address bar (`window.location`), which `history.replaceState` keeps
// current; the router's location is the one of the page load and does not move with it. `entry` is the router's, `url` the bar's.
const setBar = (search = '') => window.history.replaceState(null, '', `/drivers-groups${search}`)
const renderLogistics = (props = {}, entry = '/drivers-groups?id=975001') => renderWithProviders(
  <DriversGroupLogistics
    driversGroupState={{ driversGroup: { id: 975001, type: 0, orders_group_start_in_status: 7 } }}
    changesState={{}}
    handleChangesState={vi.fn()}
    handleParentSidebarMove={handleParentSidebarMove}
    handleUpdateDriversGroup={handleUpdateDriversGroup}
    {...props}
  />,
  { initialEntries: [entry] }
)

beforeEach(() => {
  setBar('')
  mocks.width = 1400
  mocks.addQueryToUrl.mockClear()
  mocks.removeQueryToUrl.mockClear()
  handleParentSidebarMove = vi.fn()
  handleUpdateDriversGroup = vi.fn()
})

describe('DriversGroupLogistics inline', () => {
  it('opens each sub-panel inside the section, in place of the list of entries', () => {
    renderLogistics({ inline: true })
    for (const [entry, panel] of [
      [/Group Orders/, 'Group orders panel'],
      [/Autoassign settings/, 'Autoassign panel'],
      [/Mark drivers as busy/, 'Mark busy panel']
    ]) {
      fireEvent.click(screen.getByRole('button', { name: entry }))
      expect(screen.getByText(panel)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Autoassign settings/ })).toBeNull()
      expect(screen.queryByRole('radiogroup')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Advanced logistics' }))
      expect(screen.getByRole('button', { name: /Autoassign settings/ })).toBeInTheDocument()
      expect(screen.queryByText(panel)).toBeNull()
    }
  })

  // redesign DG-R1 (R1-04): the focus follows the view that opens: into the sub-panel on «← Advanced logistics», back on the entry
  it('R1-04: opening a sub-panel puts the focus on «← Advanced logistics»; going back puts it on the entry that was opened', () => {
    renderLogistics({ inline: true })
    for (const name of [/Group Orders/, /Autoassign settings/, /Mark drivers as busy/]) {
      const entry = screen.getByRole('button', { name })
      entry.focus()
      fireEvent.click(entry)
      expect(screen.getByRole('button', { name: 'Advanced logistics' })).toHaveFocus()
      fireEvent.click(screen.getByRole('button', { name: 'Advanced logistics' }))
      expect(screen.getByRole('button', { name })).toHaveFocus()
    }
  })

  it('R1-04: a sub-panel that ?config= opens when the section mounts does not take the focus', () => {
    setBar('?id=975001&config=AUTOASSIGN_SETTINGS')
    renderLogistics({ inline: true })
    expect(screen.getByText('Autoassign panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced logistics' })).not.toHaveFocus()
  })

  it('draws no SideBar and no Modal, at a wide viewport or a narrow one', () => {
    for (const width of [1400, 900]) {
      mocks.width = width
      const { unmount } = renderLogistics({ inline: true })
      fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
      expect(screen.getByText('Autoassign panel')).toBeInTheDocument()
      expect(screen.queryByTestId('sidebar')).toBeNull()
      expect(screen.queryByTestId('modal')).toBeNull()
      unmount()
    }
  })

  it('never moves the parent side bar', () => {
    for (const width of [1400, 900]) {
      mocks.width = width
      const { unmount } = renderLogistics({ inline: true })
      fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Advanced logistics' }))
      unmount()
    }
    expect(handleParentSidebarMove).not.toHaveBeenCalled()
  })

  it('opening puts ?config= in the URL and going back takes it out', () => {
    renderLogistics({ inline: true })
    fireEvent.click(screen.getByRole('button', { name: /Group Orders/ }))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ config: 'GROUP_ORDERS' })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced logistics' }))
    expect(mocks.removeQueryToUrl).toHaveBeenLastCalledWith(['config'])
  })

  it('a ?config= in the URL opens that sub-panel when the section mounts, without rewriting the URL', () => {
    setBar('?id=975001&tab=advanced_logistics&config=AUTOASSIGN_SETTINGS')
    renderLogistics({ inline: true })
    expect(screen.getByText('Autoassign panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advanced logistics' })).toBeInTheDocument()
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
    expect(handleParentSidebarMove).not.toHaveBeenCalled()
  })

  it('R1-03: a stale ?config= in the router (page load) that is no longer in the address bar does not reopen the sub-panel', () => {
    setBar('?id=975001&tab=advanced_logistics')
    renderLogistics({ inline: true }, '/drivers-groups?id=1&tab=advanced_logistics&config=GROUP_ORDERS')
    expect(screen.queryByText('Group orders panel')).toBeNull()
    expect(screen.getByRole('button', { name: /Autoassign settings/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Advanced logistics' })).toBeNull()
  })

  it('R1-03: a group that opens later reads the address bar again, and one without ?config= stays on the list', () => {
    const props = (id) => ({
      inline: true,
      driversGroupState: { driversGroup: { id, type: 0 } },
      changesState: {},
      handleChangesState: vi.fn(),
      handleParentSidebarMove,
      handleUpdateDriversGroup
    })
    const view = renderLogistics({ inline: true })
    expect(screen.queryByText('Autoassign panel')).toBeNull()
    setBar('?id=975002&config=AUTOASSIGN_SETTINGS')
    view.rerender(<DriversGroupLogistics {...props(975002)} />)
    expect(screen.getByText('Autoassign panel')).toBeInTheDocument()
    setBar('?id=975003')
    view.rerender(<DriversGroupLogistics {...props(975003)} />)
    expect(screen.queryByText('Autoassign panel')).toBeNull()
    expect(screen.getByRole('button', { name: /Autoassign settings/ })).toBeInTheDocument()
  })

  it('R1-03: leaving the section with a sub-panel open takes ?config= out of the URL; with the list showing there is nothing to take out', () => {
    const view = renderLogistics({ inline: true })
    view.unmount()
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
    const second = renderLogistics({ inline: true })
    fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
    second.unmount()
    expect(mocks.removeQueryToUrl).toHaveBeenCalledWith(['config'])
  })

  it('a ?config= that is not one of the three leaves the list of entries (nothing blank)', () => {
    setBar('?id=975001&config=NOPE')
    renderLogistics({ inline: true })
    expect(screen.getByRole('button', { name: /Autoassign settings/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Advanced logistics' })).toBeNull()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('a ?config= for the type-0 panels still opens them for a company group, as main did', () => {
    setBar('?id=975001&config=GROUP_ORDERS')
    renderLogistics({ inline: true, driversGroupState: { driversGroup: { id: 975001, type: 1 } } })
    expect(screen.getByText('Group orders panel')).toBeInTheDocument()
  })

  it('Save stays reachable inside a sub-panel and sends the pending changes', () => {
    const changes = { autoassign_max_orders: 7 }
    renderLogistics({ inline: true, changesState: changes })
    fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(handleUpdateDriversGroup).toHaveBeenCalledWith(changes)
  })

  it('the group changing closes an open sub-panel', () => {
    const view = renderLogistics({ inline: true })
    fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
    view.rerender(
      <DriversGroupLogistics
        inline
        driversGroupState={{ driversGroup: { id: 975002, type: 0 } }}
        changesState={{}}
        handleChangesState={vi.fn()}
        handleParentSidebarMove={handleParentSidebarMove}
        handleUpdateDriversGroup={handleUpdateDriversGroup}
      />
    )
    expect(screen.queryByText('Autoassign panel')).toBeNull()
    expect(screen.getByRole('button', { name: /Autoassign settings/ })).toBeInTheDocument()
  })

  it('keeps the list: the status radiogroup and the entries that depend on the type', () => {
    renderLogistics({ inline: true, driversGroupState: { driversGroup: { id: 975001, type: 1 } } })
    expect(screen.getByRole('radiogroup', { name: 'Start group in status' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Group Orders/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Autoassign settings/ })).toBeInTheDocument()
  })
})

describe('DriversGroupLogistics without inline (as main)', () => {
  it('a wide viewport opens the SideBar next to the list and moves the parent side bar', () => {
    renderLogistics()
    fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
    expect(within(screen.getByTestId('sidebar')).getByText('Autoassign panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Autoassign settings/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Advanced logistics' })).toBeNull()
    expect(handleParentSidebarMove).toHaveBeenCalledWith(700)
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ config: 'AUTOASSIGN_SETTINGS' })
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('a narrow viewport uses the Modal', () => {
    mocks.width = 900
    renderLogistics()
    fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
    expect(within(screen.getByTestId('modal')).getByText('Autoassign panel')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(handleParentSidebarMove).toHaveBeenCalledWith(0)
  })

  it('R1-03: without inline the router location still decides ?config= (the address bar is not read)', () => {
    renderLogistics({}, '/drivers-groups?id=975001&config=AUTOASSIGN_SETTINGS')
    expect(within(screen.getByTestId('sidebar')).getByText('Autoassign panel')).toBeInTheDocument()
    cleanup()
    setBar('?id=975001&config=AUTOASSIGN_SETTINGS')
    renderLogistics({})
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(mocks.removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('`inline={false}` is the same as leaving it out', () => {
    renderLogistics({ inline: false })
    fireEvent.click(screen.getByRole('button', { name: /Autoassign settings/ }))
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })
})
