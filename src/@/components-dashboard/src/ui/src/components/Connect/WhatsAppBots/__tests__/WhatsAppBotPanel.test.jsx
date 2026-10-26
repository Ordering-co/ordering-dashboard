import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { WhatsAppBotPanel } from '../WhatsAppBotPanel'

const saved = {
  branchSelectionMode: 'auto',
  primaryColor: '#aabbcc',
  secondaryColor: '#112233'
}

const renderPanel = (saveBotSettings) => renderWithProviders(
  <WhatsAppBotPanel
    open
    botId='4'
    title='Pizza Hut'
    settingsState={{ loading: false, saving: false, error: null, saved, savedNotice: false }}
    saveBotSettings={saveBotSettings}
    reloadBotSettings={vi.fn()}
    onClose={vi.fn()}
  />
)

describe('WhatsApp bot settings panel', () => {
  it('shows the form shape while the settings load', () => {
    const { container } = renderWithProviders(
      <WhatsAppBotPanel
        open
        botId='4'
        title='Pizza Hut'
        settingsState={{ loading: true, saving: false, error: null, saved: null, savedNotice: false }}
        saveBotSettings={vi.fn()}
        reloadBotSettings={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Pizza Hut' })).toBeTruthy()
    expect(container.querySelectorAll('.react-loading-skeleton')).toHaveLength(16)
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('sends only the color that changed', () => {
    const saveBotSettings = vi.fn()
    renderPanel(saveBotSettings)

    fireEvent.change(screen.getByRole('textbox', { name: /Primary color/ }), { target: { value: '#00aa00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(saveBotSettings).toHaveBeenCalledWith({ webview_primary_color: '#00aa00' })
  })

  it('shows the webview defaults when no color is saved', () => {
    const { container } = renderWithProviders(
      <WhatsAppBotPanel
        open
        botId='4'
        title='Pizza Hut'
        settingsState={{
          loading: false,
          saving: false,
          error: null,
          saved: { branchSelectionMode: 'auto', primaryColor: '', secondaryColor: '' },
          savedNotice: false
        }}
        saveBotSettings={vi.fn()}
        reloadBotSettings={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const swatches = container.querySelectorAll('input[type="color"]')
    expect(swatches[0].value).toBe('#c4271b')
    expect(swatches[1].value).toBe('#ffc72c')
    expect(screen.getByRole('textbox', { name: 'Primary color' }).value).toBe('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('sends null when a color is cleared', () => {
    const saveBotSettings = vi.fn()
    renderPanel(saveBotSettings)

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(saveBotSettings).toHaveBeenCalledWith({ webview_primary_color: null })
  })

  it('puts brand, branch and colors ahead of the channel settings', () => {
    renderWithProviders(
      <WhatsAppBotPanel
        open
        botId='4'
        title='Pizza Hut'
        brandName='Pizza Hut'
        settingsState={{ loading: false, saving: false, error: null, saved, savedNotice: false }}
        saveBotSettings={vi.fn()}
        reloadBotSettings={vi.fn()}
        onClose={vi.fn()}
        brandsState={{
          loading: false,
          loaded: true,
          error: null,
          brands: [{ id: 67, name: 'Pizza Hut', enabled: true }]
        }}
        brandId={67}
        connectionProps={{ connectionState: { loading: false, connection: null, pending: null, notice: null } }}
      />
    )

    const text = document.body.textContent
    const brand = text.indexOf('Brand')
    expect(screen.getByRole('button', { name: 'Brand' })).toBeEnabled()
    const branch = text.indexOf('Branch selection')
    const colors = text.indexOf('WhatsApp webview colors')
    const channel = text.indexOf('WhatsApp Bot channel settings')
    expect(brand).toBeGreaterThanOrEqual(0)
    expect(brand).toBeLessThan(branch)
    expect(branch).toBeLessThan(colors)
    expect(colors).toBeLessThan(channel)
  })

  it('asks before changing the brand, then sends the franchise with the other changes', () => {
    const saveBotSettings = vi.fn()
    const brands = [
      { id: 67, name: 'Pizza Hut', enabled: true, logo: null },
      { id: 8, name: 'Other', enabled: true, logo: 'https://cdn.test/other.png' },
      { id: 9, name: 'Closed', enabled: false, logo: null }
    ]
    renderWithProviders(
      <WhatsAppBotPanel
        open
        botId='4'
        title='Pizza Hut'
        brandId={67}
        brandName='Pizza Hut'
        brandsState={{ loading: false, loaded: true, error: null, brands }}
        loadBrands={vi.fn()}
        settingsState={{ loading: false, saving: false, error: null, saved, savedNotice: false }}
        saveBotSettings={saveBotSettings}
        reloadBotSettings={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const select = screen.getByRole('button', { name: 'Brand' })
    expect(select).toBeEnabled()
    fireEvent.click(select)
    expect(screen.getByRole('option', { name: 'Closed (Disabled)' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('option', { name: 'Pizza Hut' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.change(screen.getByRole('textbox', { name: /Primary color/ }), { target: { value: '#00aa00' } })
    fireEvent.click(screen.getByRole('option', { name: 'Other' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveBotSettings).not.toHaveBeenCalled()

    const dialog = document.getElementById('app-modals')
    expect(within(dialog).getByText('Are you sure you want to change the brand?')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(saveBotSettings).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(within(document.getElementById('app-modals')).getByRole('button', { name: 'Confirm change' }))
    expect(saveBotSettings).toHaveBeenCalledWith(
      { webview_primary_color: '#00aa00' },
      { franchiseId: 8, brand: brands[1] }
    )
  })

  it('changes enabled from the same panel', () => {
    const onEnabledChange = vi.fn()
    renderWithProviders(
      <WhatsAppBotPanel
        open
        botId='4'
        title='Pizza Hut'
        enabled
        onEnabledChange={onEnabledChange}
        settingsState={{ loading: false, saving: false, error: null, saved, savedNotice: false }}
        saveBotSettings={vi.fn()}
        reloadBotSettings={vi.fn()}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Agent' }))
    expect(onEnabledChange).toHaveBeenCalledWith(false)
  })
})
