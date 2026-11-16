import React from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ActionSelectorWrapper } from '../styles'

describe('OrderDetailsHeader action trigger', () => {
  it('keeps the menu trigger at the shared coarse target size', () => {
    renderWithProviders(
      <ActionSelectorWrapper>
        <div><button type='button'>More options</button></div>
      </ActionSelectorWrapper>
    )

    const trigger = screen.getByRole('button', { name: 'More options' })
    expect(window.getComputedStyle(trigger).height).toBe('44px')
    expect(window.getComputedStyle(trigger).minWidth).toBe('44px')
  })
})
