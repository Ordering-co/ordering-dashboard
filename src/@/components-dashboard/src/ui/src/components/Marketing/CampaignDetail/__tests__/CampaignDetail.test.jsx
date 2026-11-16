import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const addQueryToUrl = vi.hoisted(() => vi.fn())

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback],
  CampaignDetail: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../Shared', () => ({
  Confirm: () => null,
  Alert: () => null
}))

vi.mock('../../../../utils', () => ({ addQueryToUrl }))
vi.mock('../../../../styles', () => ({ IconButton: () => null }))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))
vi.mock('../../CampaignDetailGeneral', () => ({ CampaignDetailGeneral: () => <div data-testid='general-panel' /> }))
vi.mock('../../CampaignEmail', () => ({ CampaignEmail: () => <div data-testid='email-panel' /> }))
vi.mock('../../CampaignSMS', () => ({ CampaignSMS: () => null }))
vi.mock('../../CampaignWhatsapp', () => ({ CampaignWhatsapp: () => null }))
vi.mock('../../CampaignNotification', () => ({ CampaignNotification: () => null }))
vi.mock('../../CampaignPopup', () => ({ CampaignPopup: () => null }))
vi.mock('../../CampaignWebHook', () => ({ CampaignWebHook: () => null }))

import { CampaignDetail } from '../index'

const renderDetail = () => renderWithProviders(
  <CampaignDetail
    isAddMode
    formState={{ changes: {}, loading: false }}
    campaignState={{ campaign: null }}
    contactState={{ changes: { contact_type: 'email' } }}
    handleDeleteCampaign={vi.fn()}
  />
)

describe('CampaignDetail tabs', () => {
  beforeEach(() => addQueryToUrl.mockClear())

  it('renders General and Content as native buttons with exact pressed state', () => {
    renderDetail()
    const general = screen.getByRole('button', { name: 'General' })
    const content = screen.getByRole('button', { name: 'Content' })
    ;[general, content].forEach(tab => {
      expect(tab.tagName).toBe('BUTTON')
      expect(tab).toHaveAttribute('type', 'button')
    })
    expect(general).toHaveAttribute('aria-pressed', 'true')
    expect(content).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('general-panel')).toBeInTheDocument()
  })

  it('reaches the tabs with Tab and Enter on Content calls handleTabClick', async () => {
    const user = userEvent.setup()
    renderDetail()
    const general = screen.getByRole('button', { name: 'General' })
    const content = screen.getByRole('button', { name: 'Content' })

    await user.tab()
    expect(general).toHaveFocus()
    await user.tab()
    expect(content).toHaveFocus()

    addQueryToUrl.mockClear()
    await user.keyboard('{Enter}')
    expect(addQueryToUrl).toHaveBeenCalledTimes(1)
    expect(addQueryToUrl).toHaveBeenCalledWith({ tab: 'content' })
    expect(content).toHaveAttribute('aria-pressed', 'true')
    expect(general).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('email-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('general-panel')).toBeNull()
  })
})
