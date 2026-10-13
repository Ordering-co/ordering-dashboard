/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const listeners = {}

vi.mock('../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [null, { configurations: { subdomain: 'ordering' } }],
  useEvent: () => [{
    on: (event, handler) => { listeners[event] = handler },
    off: (event) => { delete listeners[event] }
  }],
  LogoutAction: ({ UIComponent, ...props }) => (
    <UIComponent {...props} handleLogoutClick={props.handleLogoutClick || (() => {})} />
  ),
  LanguageSelector: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      languagesState={{
        loading: false,
        languages: [
          { code: 'en', name: 'English' },
          { code: 'es', name: 'Spanish' }
        ]
      }}
      currentLanguage='en'
      handleChangeLanguage={() => {}}
    />
  )
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true)
}))

vi.mock('../../styles', () => ({
  Button: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))

vi.mock('../../styles/Select', () => ({
  Select: ({ options = [], onChange, defaultValue }) => (
    <select
      aria-label='language'
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.content}</option>
      ))}
    </select>
  )
}))

import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { Layout } from '../Layout'
import { LogoutButton } from '../LogoutButton'
import { LanguageSelector } from '../LanguageSelector'
import { DisabledFeatureAlert } from '../DisabledFeatureAlert'
import { NotNetworkConnectivity } from '../NotNetworkConnectivity'
import { WebsocketConnectionBanner } from '../WebsocketConnectionBanner'

describe('shell UI components', () => {
  beforeEach(() => {
    Object.keys(listeners).forEach((key) => delete listeners[key])
    useOnlineStatus.mockReturnValue(true)
  })

  it('renders layout children', () => {
    renderWithProviders(
      <Layout pt={12}>
        <span>Shell child</span>
      </Layout>
    )
    expect(screen.getByText('Shell child')).toBeInTheDocument()
  })

  it('wires logout button click', () => {
    const handleLogoutClick = vi.fn()
    renderWithProviders(<LogoutButton handleLogoutClick={handleLogoutClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Logout/i }))
    expect(handleLogoutClick).toHaveBeenCalledOnce()
  })

  it('renders language selector options', () => {
    renderWithProviders(<LanguageSelector />)
    expect(screen.getByLabelText('language')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Spanish' })).toBeInTheDocument()
  })

  it('renders disabled feature alert with sales link', () => {
    renderWithProviders(<DisabledFeatureAlert />, {
      theme: { colors: { primary: '#00f' }, images: {} }
    })
    expect(screen.getByText('Your package does not include this function')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get this feature' }))
      .toHaveAttribute('href', 'https://www.ordering.com/ordering-sales')
  })

  it('hides connectivity image while online and shows it offline', () => {
    useOnlineStatus.mockReturnValue(true)
    const { unmount } = renderWithProviders(<NotNetworkConnectivity />, {
      theme: { colors: {}, images: { general: { notNetwork: '/offline.svg' } } }
    })
    expect(screen.getByAltText('Not network').closest('div').parentElement)
      .toHaveStyle({ display: 'none' })
    unmount()

    useOnlineStatus.mockReturnValue(false)
    renderWithProviders(<NotNetworkConnectivity />, {
      theme: { colors: {}, images: { general: { notNetwork: '/offline.svg' } } }
    })
    expect(screen.getByAltText('Not network').closest('div').parentElement)
      .toHaveStyle({ display: 'flex' })
  })

  it('shows websocket banner after connection failure and dismisses it', () => {
    renderWithProviders(<WebsocketConnectionBanner />, {
      theme: { colors: { warning: '#f5a623' }, images: {} }
    })

    expect(screen.queryByText('Connection issue')).not.toBeInTheDocument()

    act(() => {
      listeners.websocket_connection_failed?.()
    })

    expect(screen.getByText('Connection issue')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByText('Connection issue')).not.toBeInTheDocument()
  })
})
