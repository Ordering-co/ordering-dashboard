import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { useLeaveGuard } from '../../../Shared/Product'
import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { useHubFormReport } from '../../SettingsHubForm/useHubFormReport'
import { useSettingsHubGuard } from '../../SettingsHub/useSettingsHubGuard'

const api = vi.hoisted(() => ({ ordering: { project: 'orderingv1', url: 'https://api.test/' } }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [api.ordering]
}))

// The Settings tab: a stand-in for SettingsList that registers a pending change in the leave host it is given (`leaveGuard`, )
vi.mock('../../SettingsList', () => ({
  SettingsList: ({ category, focus, leaveGuard }) => {
    const [value, setValue] = React.useState('')
    const entry = React.useRef(null)
    entry.current = {
      isDirty: () => value !== '',
      count: () => 1,
      save: () => ({ ok: true }),
      discard: () => setValue('')
    }
    React.useEffect(() => leaveGuard?.register?.(entry), [leaveGuard])
    return (
      <div data-testid='stripe-connect-settings' data-category={category?.key} data-focus={focus}>
        <input aria-label='Client ID' value={value} onChange={event => setValue(event.target.value)} />
      </div>
    )
  }
}))

// The Configuration tab: the payout rule form registers the way PayoutRuleForm does, with the real hooks
vi.mock('../../../Shared/PayoutRuleForm', () => ({
  PayoutRuleForm: ({ scope }) => {
    const [value, setValue] = React.useState('1')
    const dirty = value !== '1'
    useLeaveGuard({ dirty, count: 1, save: () => ({ ok: true }), discard: () => setValue('1') })
    useHubFormReport(`payout-rule:${scope}:global`, { dirty, saving: false })
    return (
      <div data-testid={`payout-rule-${scope}`}>
        <input aria-label={`Fixed amount ${scope}`} value={value} onChange={event => setValue(event.target.value)} />
      </div>
    )
  }
}))

import { SettingsStripeConnect } from '../index'

const category = { key: 'addon_stripe_connect', configs: [{ key: 'stripe_connect_sandbox' }] }

describe('SettingsStripeConnect', () => {
  beforeEach(() => {
    api.ordering = { project: 'orderingv1', url: 'https://api.test/' }
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } })
  })

  it('opens on Settings with the section configs', () => {
    renderWithProviders(<SettingsStripeConnect category={category} focus='stripe_connect_client_id' />)

    expect(screen.getByRole('tablist', { name: 'Stripe Connect' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Settings', 'Configuration'])
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true')

    const settings = screen.getByTestId('stripe-connect-settings')
    expect(settings).toHaveAttribute('data-category', 'addon_stripe_connect')
    expect(settings).toHaveAttribute('data-focus', 'stripe_connect_client_id')
  })

  it('leaves the configs when another tab is chosen and brings them back', () => {
    renderWithProviders(<SettingsStripeConnect category={category} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('stripe-connect-settings')).not.toBeInTheDocument()
    expect(screen.getByTestId('payout-rule-platform')).toBeInTheDocument()
    expect(screen.getByTestId('payout-rule-driver')).toBeInTheDocument()
    expect(screen.getByText('Changes apply only to orders placed after you save.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByTestId('stripe-connect-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('payout-rule-platform')).not.toBeInTheDocument()
  })

  // R-F1 (bugs H): the tab change is a way out of the forms on screen, so it goes through the leave guard like a category or a route
  describe('leave guard on the tab change', () => {
    const openConfiguration = () => {
      renderWithProviders(<SettingsStripeConnect category={category} />)
      fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
    }
    const typeInRule = (value) => fireEvent.change(screen.getByLabelText('Fixed amount platform'), { target: { value } })

    it('asks before leaving a dirty payout rule form, and the tab does not change', async () => {
      openConfiguration()
      typeInRule('5')

      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))

      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      // the page behind the open dialog is hidden from the accessibility tree
      expect(screen.getByRole('tab', { name: 'Configuration', hidden: true })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('payout-rule-platform')).toBeInTheDocument()
      expect(screen.queryByTestId('stripe-connect-settings')).not.toBeInTheDocument()
    })

    // Owner decision 27 B (2026-10-21, ): the same «Discard your changes?» as a section change in the hub (decision 17)
    it('asks with the hub words: «Discard your changes?», Keep editing and Discard, no «Save and continue» (owner decision 27)', async () => {
      openConfiguration()
      typeInRule('5')
      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))

      const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
      expect(dialog).toHaveTextContent('You have unsaved changes in Configuration. If you leave, they are lost.')
      expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: 'Save and continue' })).not.toBeInTheDocument()
    })

    it('Keep editing stays on the tab with what was typed', async () => {
      openConfiguration()
      typeInRule('5')
      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))

      fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' }))

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Fixed amount platform')).toHaveValue('5')
    })

    it('Discard switches to the other tab', async () => {
      openConfiguration()
      typeInRule('5')
      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))

      fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))

      await waitFor(() => expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true'))
      expect(screen.getByTestId('stripe-connect-settings')).toBeInTheDocument()
      expect(screen.queryByTestId('payout-rule-platform')).not.toBeInTheDocument()
    })

    it('asks too before leaving the Settings tab with unsaved configs (SettingsList registers in the same host)', async () => {
      renderWithProviders(<SettingsStripeConnect category={category} />)
      fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'ca_123' } })

      fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))

      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Settings', hidden: true })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Client ID')).toHaveValue('ca_123')
    })

    it('switches at once when nothing is dirty, and when the tab is already the open one', () => {
      openConfiguration()

      fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('stripe-connect-settings')).toBeInTheDocument()
    })

    it('a category or route change in the hub asks once, with the hub dialog and not this one', async () => {
      const listeners = []
      const state = { blocker: null }
      const history = {
        location: { key: 'section' },
        listen: listener => {
          listeners.push(listener)
          return () => listeners.splice(listeners.indexOf(listener), 1)
        },
        block: blocker => {
          state.blocker = blocker
          return () => { state.blocker = null }
        },
        go: vi.fn(),
        push: vi.fn(),
        replace: vi.fn()
      }
      const Hub = () => {
        const guard = useSettingsHubGuard({
          history,
          getCurrentSectionKey: () => 'addon_stripe_connect',
          getCurrentSectionLabel: () => 'Stripe Connect',
          getLocationSectionKey: () => null
        })
        const formContext = React.useMemo(() => ({ product: true, report: guard.report }), [guard.report])
        return (
          <SettingsHubFormContext.Provider value={formContext}>
            <SettingsStripeConnect category={category} />
            {guard.pending && <div data-testid='hub-dialog'>hub asks</div>}
          </SettingsHubFormContext.Provider>
        )
      }
      renderWithProviders(<Hub />)
      fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
      typeInRule('5')
      await waitFor(() => expect(state.blocker).toBeTruthy())

      act(() => { expect(state.blocker({ key: 'other', pathname: '/settings' }, 'PUSH')).toBe(false) })

      expect(await screen.findByTestId('hub-dialog')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getAllByTestId('hub-dialog')).toHaveLength(1)
      expect(within(screen.getByRole('tablist')).getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true')

      // the tab change in the same hub asks once: this section's dialog, the hub's blocker stays out of it
      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
      expect(await screen.findAllByRole('alertdialog')).toHaveLength(1)
    })
  })

  it('shows the OAuth redirect URI of each payment method to register in Stripe, and copies each one', async () => {
    renderWithProviders(<SettingsStripeConnect category={category} />)

    // a platform that registers only the v2 address cannot connect stores with Stripe Connect
    const legacyUri = 'https://api.test/v400/en/orderingv1/payments/stripe_connect/callback'
    const v2Uri = 'https://apiv4.ordering.co/v400/en/orderingv1/stripe_connect_accounts/callback'
    const card = screen.getByText('OAuth redirect URI').closest('section')
    expect(within(card).getByText(legacyUri)).toBeInTheDocument()
    expect(within(card).getByText(v2Uri)).toBeInTheDocument()
    expect(within(card).getByText(/add both, so stores can connect with either/)).toBeInTheDocument()
    expect(within(card).getByText(/Test mode and live mode keep separate lists/)).toBeInTheDocument()
    expect(within(card).getByText(/Drivers use Express accounts/)).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Copy OAuth redirect URI: Stripe Connect' }))
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(legacyUri)
    fireEvent.click(within(card).getByRole('button', { name: 'Copy OAuth redirect URI: Stripe Connect v2' }))
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(v2Uri)
    await waitFor(() => expect(within(card).getAllByText('Copied').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('tab', { name: 'Configuration' }))
    expect(screen.queryByText('OAuth redirect URI')).not.toBeInTheDocument()
  })

  it('shows no redirect URI while the project is unknown', () => {
    api.ordering = { project: null }
    renderWithProviders(<SettingsStripeConnect category={category} />)

    expect(screen.queryByText('OAuth redirect URI')).not.toBeInTheDocument()
    expect(screen.getByTestId('stripe-connect-settings')).toBeInTheDocument()
  })
})
