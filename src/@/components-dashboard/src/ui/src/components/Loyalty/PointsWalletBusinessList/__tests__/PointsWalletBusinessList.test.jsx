/* eslint-disable import/first */
// the wallet rules per store in Product pieces. The controller is a stand-in that hands the UI a given list and spies; the
// detail, the side bar and the modal are stubs. Covered: P/SearchField sent after main's wait (at once on clear), each row's P/Switch and
// P/Checkbox named after the store and calling the controller as main did, P/Avatar with initials when there is no logo, P/Pagination,
// the empty and loading states, and the row that opens the store's detail (the alerts for no plan and a disabled store, as main).
import React from 'react'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const ctl = vi.hoisted(() => ({ list: null, spies: null, pagination: null, alert: null, detail: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => `optimized:${url}` }],
  PointsWalletBusinessList: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      businessList={ctl.list}
      paginationProps={ctl.pagination}
      searchValue=''
      pointWallet={{ id: 1, type: 'credit_point' }}
      {...ctl.spies}
    />
  )
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1400 }) }))
vi.mock('../../../Shared', () => ({
  Alert: ({ open, content }) => {
    ctl.alert = open ? content : null
    return null
  },
  SideBar: ({ children }) => <div data-testid='sidebar'>{children}</div>,
  Modal: ({ children }) => <div data-testid='modal'>{children}</div>
}))
vi.mock('../../PointsWalletBusinessDetail', () => ({
  PointsWalletBusinessDetail: (props) => {
    ctl.detail = props
    return <div data-testid='detail'>{props.walletData?.name}</div>
  }
}))

import { PointsWalletBusinessList } from '../index'

const STORES = [
  { id: 7, name: 'Store A', logo: 'a.png', wallet_enabled: true, redeems: true, accumulates: false },
  { id: 8, name: 'Burger Hub', logo: null, wallet_enabled: false, redeems: false, accumulates: false }
]

const renderList = (list = { loading: false, error: null, businesses: STORES }) => {
  ctl.list = list
  return renderWithProviders(<PointsWalletBusinessList handleParentSidebarMove={vi.fn()} />)
}

beforeEach(() => {
  ctl.alert = null
  ctl.detail = null
  ctl.pagination = { currentPage: 1, pageSize: 10, totalPages: 3, totalItems: 25 }
  ctl.spies = {
    handleCheckBox: vi.fn(),
    handleChangeSwitch: vi.fn(),
    handleChangeSearch: vi.fn(),
    handleUpdateBusinessList: vi.fn(),
    setPaginationProps: vi.fn()
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PointsWalletBusinessList · Product pieces', () => {
  it('the search is a Product search field, sent after 750ms and at once when cleared', () => {
    vi.useFakeTimers()
    renderList()
    const search = screen.getByRole('searchbox', { name: 'Search' })
    fireEvent.change(search, { target: { value: 'bur' } })
    expect(ctl.spies.handleChangeSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(750) })
    expect(ctl.spies.handleChangeSearch).toHaveBeenLastCalledWith('bur')

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(ctl.spies.handleChangeSearch).toHaveBeenLastCalledWith('')
  })

  it('each row has a Product switch and checkboxes named after the store', () => {
    renderList()
    const status = screen.getByRole('switch', { name: 'Status, Store A' })
    expect(status).toHaveClass('odc-switch')
    expect(status).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Status, Burger Hub' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Redeem, Store A' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Accumulation, Store A' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Redeem, Burger Hub' })).toBeDisabled()
  })

  it('the switch and the checkboxes call the controller as main, without opening the store', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByRole('switch', { name: 'Status, Burger Hub' }))
    expect(ctl.spies.handleChangeSwitch).toHaveBeenCalledWith(8, true)
    await user.click(screen.getByRole('checkbox', { name: 'Redeem, Store A' }))
    expect(ctl.spies.handleCheckBox).toHaveBeenCalledWith(7, 'redeems', false)
    await user.click(screen.getByRole('checkbox', { name: 'Accumulation, Store A' }))
    expect(ctl.spies.handleCheckBox).toHaveBeenCalledWith(7, 'accumulates', true)
    expect(screen.queryByTestId('detail')).toBeNull()
  })

  it('a logo is an avatar image; without one, the initials', () => {
    const { container } = renderList()
    const avatars = container.querySelectorAll('.odc-avatar[data-kind="business"]')
    expect(avatars).toHaveLength(2)
    expect(avatars[0].querySelector('img')).toHaveAttribute('src', 'optimized:a.png')
    expect(avatars[1]).toHaveTextContent('BH')
  })

  it('a row opens the store detail; a disabled store gets main\'s alert instead', async () => {
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByRole('button', { name: /Burger Hub/ }))
    expect(ctl.alert).toBe('Disabled business')
    expect(screen.queryByTestId('detail')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Store A/ }))
    expect(screen.getByTestId('detail')).toHaveTextContent('Store A')
    expect(ctl.detail).toMatchObject({ isBusiness: true, walletData: expect.objectContaining({ id: 7 }) })
  })

  it('the pagination is the Product one and moves the controller\'s page and size', async () => {
    const user = userEvent.setup()
    renderList()
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    await user.click(within(nav).getByRole('button', { name: 'Next page' }))
    const pageUpdate = ctl.spies.setPaginationProps.mock.calls.at(-1)[0]
    expect(pageUpdate({ currentPage: 1, pageSize: 10 })).toEqual({ currentPage: 2, pageSize: 10 })
  })

  it('empty and loading states', () => {
    const { unmount } = renderList({ loading: false, error: null, businesses: [] })
    expect(screen.getByText('No businesses found')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    unmount()

    const { container } = renderList({ loading: true, error: null, businesses: [] })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
  })
})
