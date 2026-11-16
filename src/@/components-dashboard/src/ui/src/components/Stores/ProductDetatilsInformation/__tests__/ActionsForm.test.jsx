// redesign SP-F2 (D2): the Save row of Product details > Information sticks to the foot of the panel.
import React from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ActionsForm, FormInput } from '../styles'

describe('Information form: Save row', () => {
  const mount = () => renderWithProviders(
    <FormInput>
      <ActionsForm data-testid='actions'>
        <button type='submit'>Save</button>
      </ActionsForm>
    </FormInput>
  )

  it('is pinned to the bottom edge of the scrolling panel, with its own surface and a top border', () => {
    mount()
    const style = window.getComputedStyle(screen.getByTestId('actions'))

    expect(style.position).toBe('sticky')
    expect(style.bottom).toBe('0px')
    expect(style.top).not.toBe('100%')
    expect(style.backgroundColor).toBe('var(--od-bg)')
    expect(style.borderBlockStart).toContain('var(--od-border)')
  })

  it('stays inside the form, so the submit button keeps validating through react-hook-form', () => {
    mount()

    expect(screen.getByRole('button', { name: 'Save' }).closest('form')).not.toBeNull()
    expect(screen.getByTestId('actions').closest('form')).not.toBeNull()
  })
})
