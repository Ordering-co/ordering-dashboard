/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ online: true }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mocks.online
}))

import { NotNetworkConnectivity } from '..'

// redesign (D6): the offline page on Product, with new text and no illustration
describe('NotNetworkConnectivity', () => {
  beforeEach(() => {
    mocks.online = true
  })

  it('paints nothing while the browser is online', () => {
    const { container } = renderWithProviders(<NotNetworkConnectivity />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('tells the user they are offline, with a level-1 heading, a status role and no image', () => {
    mocks.online = false
    renderWithProviders(<NotNetworkConnectivity />)

    expect(screen.getByRole('heading', { level: 1, name: "You're offline" })).toBeInTheDocument()
    expect(screen.getByText('Check your connection. This page comes back when you reconnect.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})
