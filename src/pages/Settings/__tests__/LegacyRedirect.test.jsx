import React from 'react'
import { describe, expect, it } from 'vitest'
import { Route, useLocation } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'
import { SettingsLegacyRedirect } from '../LegacyRedirect'

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid='hub-path'>{`${location.pathname}${location.search}`}</div>
}

describe('SettingsLegacyRedirect', () => {
  it('sends an old settings URL to the hub section', () => {
    renderWithProviders(
      <>
        <Route path='/settings/language'>
          <SettingsLegacyRedirect from='/settings/language' />
        </Route>
        <Route path='/settings'>
          <LocationProbe />
        </Route>
      </>,
      { initialEntries: ['/settings/language'] }
    )

    expect(screen.getByTestId('hub-path')).toHaveTextContent('/settings?group=languages&category=language_manager')
  })
})
