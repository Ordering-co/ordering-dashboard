/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }, { configurations: {} }],
  useSite: () => [{ sites: [] }]
}))

vi.mock('../../../../contexts/ProjectContext', () => ({
  useProjectState: () => [{}]
}))

vi.mock('react-bootstrap', () => ({
  Dropdown: {
    Item: ({ children, ...props }) => <button {...props}>{children}</button>
  }
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Input: (props) => <input {...props} />
}))

vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div role='dialog'>{children}</div> : null
}))

import { OrderTrackingLink } from '..'

describe('OrderTrackingLink', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  // redesign F6c (Q2-14): the domain source is the C18 dropdown, not a native select
  const chooseOtherDomain = (value) => {
    fireEvent.click(screen.getByRole('button', { name: 'Edit tracking URL' }))
    fireEvent.click(screen.getByRole('button', { name: /Tracking domain source/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /^Other/ }))
    const input = screen.getByRole('textbox', { name: 'Tracking domain' })
    fireEvent.change(input, { target: { value } })
    return input
  }

  it('reports invalid domains through the input accessibility contract without saving or opening a tab', () => {
    renderWithProviders(<OrderTrackingLink order={{ uuid: 'order-uuid', hash_key: 'secret-hash' }} />)
    const input = chooseOtherDomain('not a domain')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid domain')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'tracking-domain-error')
    expect(window.localStorage.getItem('tracking_domain:demo')).toBeNull()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('saves a manual domain per project and opens the tracking URL in a new tab', () => {
    renderWithProviders(<OrderTrackingLink order={{ uuid: 'order-uuid', hash_key: 'secret-hash' }} />)
    expect(screen.getByRole('button', { name: 'Open tracking URL' })).toBeDisabled()
    chooseOtherDomain('tracking.example.com/path')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(window.localStorage.getItem('tracking_domain:demo')).toBe('https://tracking.example.com/path')
    expect(window.open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open tracking URL' }))
    expect(window.open).toHaveBeenCalledWith('https://tracking.example.com/path/orders/order-uuid?hash=secret-hash', '_blank', 'noopener,noreferrer')
  })
})
