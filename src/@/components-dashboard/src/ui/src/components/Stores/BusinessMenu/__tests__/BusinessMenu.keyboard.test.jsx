/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const { addQueryToUrl, removeQueryToUrl } = vi.hoisted(() => ({
  addQueryToUrl: vi.fn(),
  removeQueryToUrl: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessMenu: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../utils', () => ({ addQueryToUrl, removeQueryToUrl }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))

// P/AsyncSwitch (the «Available» switch of each row) reads the language straight from its context
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

vi.mock('../../BusinessMenuOptions', () => ({
  BusinessMenuOptions: ({ menu }) => <div data-testid='menu-options' data-menu-id={String(menu?.id)} />
}))

import { BusinessMenu } from '../index'

const buildProps = () => ({
  business: { id: 7 },
  setIsExtendExtraOpen: vi.fn(),
  reloadMenus: vi.fn(),
  businessMenusState: {
    loading: false,
    error: null,
    menus: [
      { id: 1, name: 'Lunch menu', enabled: true },
      { id: 2, name: 'Dinner menu', enabled: false }
    ],
    menusShared: []
  },
  handleChangeBusinessMenuActiveState: vi.fn().mockResolvedValue({ ok: true }),
  handleSuccessBusinessMenu: vi.fn(),
  isSelectedSharedMenus: false,
  setIsSelectedSharedMenus: vi.fn(),
  sitesState: { sites: [] },
  setBusinessMenusState: vi.fn()
})

describe('BusinessMenu row name as the keyboard control', () => {
  beforeEach(() => {
    addQueryToUrl.mockClear()
    removeQueryToUrl.mockClear()
  })

  it('exposes each menu name as a native button, reachable with Tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BusinessMenu {...buildProps()} />)

    const name = screen.getByRole('button', { name: 'Dinner menu' })
    expect(name.tagName).toBe('BUTTON')
    expect(name.getAttribute('type')).toBe('button')
    expect(name.hasAttribute('disabled')).toBe(false)
    expect(name.hasAttribute('aria-current')).toBe(false)

    // Stops before the first name: Add menu, the tabs (one stop, the selected tab; the arrows move between them), the search and the
    // first row switch.
    await user.tab() // Add menu
    await user.tab() // Menu tab
    await user.tab() // search
    await user.tab() // first row switch
    expect(screen.getByRole('switch', { name: 'Available: Lunch menu' })).toHaveFocus()
    await user.tab() // first row name
    expect(screen.getByRole('button', { name: 'Lunch menu' })).toHaveFocus()
  })

  it('opens the edit panel of that menu with Enter on its name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BusinessMenu {...buildProps()} />)
    expect(screen.queryByTestId('menu-options')).toBeNull()

    screen.getByRole('button', { name: 'Dinner menu' }).focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('2'))
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(addQueryToUrl).toHaveBeenCalledWith({ menu: 2 })
  })

  it('opens the edit panel with Space as well, once', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BusinessMenu {...buildProps()} />)

    screen.getByRole('button', { name: 'Lunch menu' }).focus()
    await user.keyboard(' ')

    expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('1')
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
  })

  it('marks only the open menu with aria-current', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BusinessMenu {...buildProps()} />)

    await user.click(screen.getByRole('button', { name: 'Dinner menu' }))

    expect(screen.getByRole('button', { name: 'Dinner menu' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: 'Lunch menu' }).hasAttribute('aria-current')).toBe(false)
  })

  it('keeps the mouse row click and does not open the panel from the Available switch', async () => {
    const user = userEvent.setup()
    const props = buildProps()
    renderWithProviders(<BusinessMenu {...props} />)

    // Clicking the row away from the name still opens that menu.
    fireEvent.click(screen.getByRole('button', { name: 'Lunch menu' }).closest('div'))
    expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('1')
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)

    addQueryToUrl.mockClear()
    await user.click(screen.getByRole('switch', { name: 'Available: Dinner menu' }))
    expect(addQueryToUrl).not.toHaveBeenCalled()
    expect(props.handleChangeBusinessMenuActiveState).toHaveBeenCalledWith(2, true)
    // the switch did not open the Dinner menu: the open one is still Lunch
    expect(screen.getByTestId('menu-options').getAttribute('data-menu-id')).toBe('1')
  })
})
