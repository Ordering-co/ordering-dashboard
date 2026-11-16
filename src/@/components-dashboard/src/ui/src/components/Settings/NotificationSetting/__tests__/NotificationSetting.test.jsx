import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  SettingsList: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null
}))

vi.mock('../../SettingsSelectUI', () => ({ SettingsSelectUI: () => null }))
vi.mock('../../SettingsCustomBlocks', () => ({ SettingsCustomBlocks: () => null }))

import { NotificationSetting } from '../index'

const renderNotificationSetting = () =>
  renderWithProviders(
    <NotificationSetting
      configs={[]}
      settingsState={{ changes: [] }}
      handleInputChange={vi.fn()}
      handleCheckBoxChange={vi.fn()}
      handleClickUpdate={vi.fn()}
    />
  )

// The five section titles are the accordion toggles. They used to be a `div` with an
// `onClick`, so a keyboard user could not open a section at all.
describe('NotificationSetting accordion toggles', () => {
  it('renders every section title as a native button that reports it is collapsed', () => {
    renderNotificationSetting()
    for (const name of ['General', 'Administrator', 'Business', 'Customer', 'Driver']) {
      const toggle = screen.getByRole('button', { name })
      expect(toggle.tagName).toBe('BUTTON')
      expect(toggle).toHaveAttribute('type', 'button')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    }
  })

  it('opens a section with Enter and keeps the other toggles collapsed', async () => {
    const user = userEvent.setup()
    renderNotificationSetting()
    const administrator = screen.getByRole('button', { name: 'Administrator' })

    await user.tab()
    expect(screen.getByRole('button', { name: 'General' })).toHaveFocus()
    await user.tab()
    expect(administrator).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(administrator).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Business' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens a section with Space and closes it again with a second press', async () => {
    const user = userEvent.setup()
    renderNotificationSetting()
    const business = screen.getByRole('button', { name: 'Business' })

    business.focus()
    await user.keyboard(' ')
    expect(business).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard(' ')
    expect(business).toHaveAttribute('aria-expanded', 'false')
  })
})
