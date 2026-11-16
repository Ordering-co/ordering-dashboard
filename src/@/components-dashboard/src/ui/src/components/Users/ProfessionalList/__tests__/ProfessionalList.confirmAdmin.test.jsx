/* eslint-disable import/first */
// enabling/disabling a level-0 professional goes through ConfirmAdmin (action `user_enabled`,
// targetId the row's id); the confirmation_token it resolves with travels to handleChangeActiveUser.
import React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'
import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const lightTheme = createDashboardTheme(theme)

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (src) => src }]
}))

const seen = { confirmAdmin: null }
vi.mock('../../../Shared', () => ({
  ConfirmAdmin: (props) => {
    seen.confirmAdmin = props
    return null
  },
  Pagination: () => null,
  ColumnAllowSettingPopover: () => null
}))

import { ProfessionalList } from '..'

const renderList = (props) => render(<ThemeProvider theme={lightTheme}><ProfessionalList {...props} /></ThemeProvider>)

const USERS = [
  { id: 1, name: 'Ana', lastname: 'Lopez', level: 8, enabled: true },
  { id: 2, name: 'Beto', lastname: 'Diaz', level: 0, enabled: true }
]

const baseProps = () => ({
  usersList: { users: USERS, loading: false, error: null },
  paginationProps: { currentPage: 1, pageSize: 10, totalPages: 1 },
  getUsers: vi.fn(),
  handleChangeActiveUser: vi.fn(),
  selectedUsers: [],
  handleSelectedUsers: vi.fn(),
  handleOpenUserDetails: vi.fn(),
  handleOpenUserAddForm: vi.fn(),
  setSelectedUsers: vi.fn()
})

describe('ProfessionalList · admin (level 0) toggle asks ConfirmAdmin', () => {
  it('a non-admin row toggles at once, with no ConfirmAdmin', () => {
    const props = baseProps()
    const { container } = renderList(props)
    const [nonAdminSwitch] = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(nonAdminSwitch)
    expect(props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 1, enabled: false })
    expect(seen.confirmAdmin.open).toBe(false)
  })

  it('a level-0 row opens ConfirmAdmin with action user_enabled and the row id as targetId', () => {
    const props = baseProps()
    const { container } = renderList(props)
    const switches = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(switches[1])

    expect(props.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(seen.confirmAdmin.open).toBe(true)
    expect(seen.confirmAdmin.action).toBe('user_enabled')
    expect(seen.confirmAdmin.targetId).toBe(2)
  })

  it('confirming sends the confirmation_token with the toggle', () => {
    const props = baseProps()
    const { container } = renderList(props)
    const switches = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(switches[1])

    act(() => { seen.confirmAdmin.onConfirm('tok-prof-1') })
    expect(props.handleChangeActiveUser).toHaveBeenCalledWith({ id: 2, enabled: false, confirmationToken: 'tok-prof-1' })
  })
})
