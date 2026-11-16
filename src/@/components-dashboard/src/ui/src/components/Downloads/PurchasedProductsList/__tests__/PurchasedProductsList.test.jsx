/* eslint-disable import/first */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ collapse: vi.fn() }))
vi.mock('../../../../../../index', () => ({
  useApi: () => [{}, { configurations: { subdomain: 'tenant.test' } }],
  useLanguage: () => [{}, (key, fallback) => fallback || key]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: true }, { handleMenuCollapse: runtime.collapse }] }))
vi.mock('../../../Shared/SideBar', () => ({ SideBar: ({ children, open }) => open && <div role='dialog'>{children}</div> }))

import { PurchasedProductsList } from '../index'

const imageKeys = ['storeApp', 'driverApp', 'posApp', 'kioskApp', 'callCenterApp']
const appImages = Object.fromEntries(imageKeys.map(key => [key, `/${key}.png`]))
const fixtureTheme = {
  rtl: false,
  images: {
    apps: appImages,
    general: { appStore: '/app-store.png', googlePlay: '/google-play.png' },
    icons: { delivery: '/delivery.svg', posTerminal: '/pos.svg', poster: '/poster.svg', apple: '/apple.svg', android: '/android.svg' }
  },
  colors: { backgroundPage: '#fff', borderColor: '#ccc', headingColor: '#111', lightGray: '#555', lightPrimary: '#eef', primary: '#06f' }
}
const renderProduct = content => render(<ThemeProvider theme={fixtureTheme}>{content}</ThemeProvider>)

beforeEach(() => {
  runtime.collapse.mockClear()
  vi.restoreAllMocks()
})

describe('L2e-E5 purchased products', () => {
  it('keeps Purchased actions as exact window.open calls and excludes them from row selection', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderProduct(<PurchasedProductsList />)
    const purchase = screen.getAllByRole('button', { name: 'Purchase now' })[0]
    await user.click(purchase)
    expect(open).toHaveBeenCalledWith('https://apps.ordering.co/store/marketplace?category=306&product=1717', '_blank', 'noopener,noreferrer')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Store App 2.0' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('fully branded with your guidelines')
  })

  it('registers and cleans the original mouseup boundary only while detail is open', async () => {
    const user = userEvent.setup()
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const rendered = renderProduct(<PurchasedProductsList />)
    await user.click(screen.getByRole('button', { name: 'Store App 2.0' }))
    const registration = add.mock.calls.find(call => call[0] === 'mouseup')
    expect(registration).toBeTruthy()
    rendered.unmount()
    expect(remove).toHaveBeenCalledWith('mouseup', registration[1])
  })

  it('keeps the collapsed-menu callback exact', async () => {
    const user = userEvent.setup()
    renderProduct(<PurchasedProductsList />)
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(runtime.collapse).toHaveBeenCalledTimes(1)
    expect(runtime.collapse).toHaveBeenCalledWith(false)
  })
})
