/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../hooks/useWindowSize', () => ({
  useWindowSize: () => ({ width: 1200, height: 800 })
}))

vi.mock('../Modal', () => ({
  Modal: ({ children }) => <div>{children}</div>
}))

vi.mock('../../../styles/Buttons', () => ({
  IconButton: ({ children, ...props }) => <button type='button' {...props}>{children}</button>
}))

import { MoreSidebarLayout } from '..'

describe('MoreSidebarLayout', () => {
  it('renders desktop layout and closes from the icon button', () => {
    const onClose = vi.fn()

    renderWithProviders(
      <MoreSidebarLayout onClose={onClose}>
        <p>Extra panel</p>
      </MoreSidebarLayout>
    )

    expect(screen.getByText('Extra panel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
