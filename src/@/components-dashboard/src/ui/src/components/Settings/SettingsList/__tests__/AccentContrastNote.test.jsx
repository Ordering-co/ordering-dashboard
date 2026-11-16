// redesign J5 row 45 (my-products-dashboard P-DB5, ): the AA report of decision 30 beside the buttons color, as a notice that
// does not block saving.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { tenantAccentContrast } from '~/utils/bootTheme'

const asked = vi.hoisted(() => [])
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => { asked.push(key); return fallback }],
  useConfig: () => [{ configs: {} }],
  SettingsList: () => null
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  ColorPicker: () => <div data-testid='color-picker' />,
  NotFoundSource: () => null
}))

import { AccentContrastNote } from '../AccentContrastNote'
import { SettingsListUI } from '../index'

describe('AccentContrastNote', () => {
  it('warns, as a status, when white text on the color is below AA (4.5:1), with the ratio', () => {
    const ratio = tenantAccentContrast('#F5C518').ratio
    renderWithProviders(<AccentContrastNote value='#F5C518' />)
    const note = screen.getByRole('status')
    expect(note).toHaveTextContent(`${ratio}:1`)
    expect(note).toHaveTextContent('4.5:1')
    expect(note).toHaveAttribute('data-tone', 'warning')
  })

  // decision 42: where white misses AA the buttons paint a slightly darker shade of the color with white text, and the
  // notice says so, with one key (the dark text of is gone)
  it.each(['#2c7be5', '#F5C518'])('says the buttons use a slightly darker shade of %s so white text reads', value => {
    asked.length = 0
    renderWithProviders(<AccentContrastNote value={value} />)
    expect(screen.getByRole('status')).toHaveTextContent('so the buttons use a slightly darker shade of it to keep white text readable')
    expect(asked).toEqual(['BUTTONS_COLOR_CONTRAST_DARKER_SHADE'])
  })

  // 12-locale check: LanguageContext adds DASHBOARD_ to every key that does not already start with it, and the catalog is
  // served as DASHBOARD_<key>, so a key that starts with DASHBOARD_ is never found and stays in English
  it('asks for a key that does not start with the product prefix', () => {
    asked.length = 0
    renderWithProviders(<AccentContrastNote value='#F5C518' />)
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.filter(key => key.startsWith('DASHBOARD_'))).toEqual([])
  })

  it('says nothing for a color that passes AA, an empty value or one it cannot measure', () => {
    for (const value of ['#1D4ED8', '', null, 'not-a-color']) {
      const view = renderWithProviders(<AccentContrastNote value={value} />)
      expect(screen.queryByRole('status')).toBeNull()
      view.unmount()
    }
  })

  it('is drawn beside the buttons color picker of the settings list, and only there', () => {
    const configs = [
      { id: 1, key: 'dashboard_buttons_colors', name: 'Buttons Colors', type: 1, value: '#F5C518' },
      { id: 2, key: 'some_text', name: 'Some text', type: 1, value: '#F5C518' }
    ]
    renderWithProviders(
      <SettingsListUI
        category={{ key: 'dashboard' }}
        settingsState={{ loading: false, error: null, API: false, changes: [] }}
        configs={configs}
        formState={{ changes: [] }}
        configOptionsToHide={[]}
        handleInputChange={() => {}}
      />
    )
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByTestId('color-picker').parentElement).toContainElement(screen.getByRole('status'))
  })
})
