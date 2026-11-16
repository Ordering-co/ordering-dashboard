/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('~components', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { CloneOrder } from '..'

// redesign fix-qa E5: the two choices are a radio group of the brand (they were pressed-state buttons) and
// the action is the Product button; what is chosen and sent (`{ ...cloneState, type }`, one clone call, off
// while loading) is asserted exactly as before.
describe('CloneOrder', () => {
  it('exposes the clone choices as radios without changing the selected payload', () => {
    const setCloneState = vi.fn()
    renderWithProviders(
      <CloneOrder
        cloneState={{ type: 1, loading: false, retained: 'value' }}
        setCloneState={setCloneState}
        handleCloneOrder={vi.fn()}
      />
    )

    const fullOrder = screen.getByRole('radio', { name: 'Clone full order' })
    const productsOnly = screen.getByRole('radio', { name: 'Clone order without products' })
    expect(fullOrder).toBeChecked()
    expect(productsOnly).not.toBeChecked()

    fireEvent.click(productsOnly)
    expect(setCloneState).toHaveBeenCalledWith({ type: 2, loading: false, retained: 'value' })
  })

  it('keeps the clone action disabled while loading', () => {
    const handleCloneOrder = vi.fn()
    renderWithProviders(
      <CloneOrder
        cloneState={{ type: 1, loading: true }}
        setCloneState={vi.fn()}
        handleCloneOrder={handleCloneOrder}
      />
    )

    const clone = screen.getByRole('button', { name: 'Clone' })
    expect(clone).toBeDisabled()
    fireEvent.click(clone)
    expect(handleCloneOrder).not.toHaveBeenCalled()
  })
})
