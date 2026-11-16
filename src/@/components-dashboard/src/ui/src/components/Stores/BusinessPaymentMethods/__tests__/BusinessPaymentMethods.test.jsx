import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { getDisplayPaymethods } from '../getDisplayPaymethods'
import { PaymethodRow } from '../PaymethodRow'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

// jsdom does not load the stylesheet (vitest replaces CSS with nothing), so the rules the row depends on are read from the file
const CSS = readFileSync(path.resolve(__dirname, '../payment-methods.css'), 'utf8')
const rule = (selector) => {
  const start = CSS.indexOf(`\n${selector} {`)
  return start === -1 ? '' : CSS.slice(start, CSS.indexOf('}', start))
}

const cashRow = {
  id: 1,
  name: 'Cash',
  gateway: 'cash',
  pluginKey: null,
  installUrl: null,
  source: 'api',
  installState: 'ready'
}

const paystackInstallable = {
  id: null,
  name: 'Paystack',
  gateway: 'paystack',
  pluginKey: 'paystack',
  installUrl: 'https://paystack.plugins.orderingplus.com',
  source: 'catalog',
  installState: 'installable'
}

const longNameRow = {
  ...paystackInstallable,
  name: 'A'.repeat(80)
}

// redesign stores 5.9: the row is an `li` of the list's `ul`, with an AsyncSwitch and a name button; the props changed
// (`onToggle(paymethod, next)`, `onOpen(paymethod)`, `record`, `configs`).
const renderRow = (overrides = {}) => {
  const props = {
    paymethod: cashRow,
    displayName: cashRow.name,
    record: undefined,
    isEnabled: false,
    configs: {},
    installingPluginKey: null,
    onOpen: vi.fn(),
    onToggle: vi.fn(() => ({ ok: true })),
    onRequestInstall: vi.fn(),
    active: false,
    ...overrides
  }
  renderWithProviders(<ul><PaymethodRow {...props} /></ul>, { theme })
  return props
}

describe('getDisplayPaymethods', () => {
  it('adds catalog Install rows in store details', () => {
    const rows = getDisplayPaymethods({
      paymethods: [cashRow],
      plugins: [],
      excludeGateways: []
    })
    expect(rows.some(row => row.pluginKey === 'paystack' && row.installState === 'installable')).toBe(true)
  })

  // redesign stores 4.A (decision 11)
  it('leaves the catalog rows out when the person may not install, and keeps the store\'s methods', () => {
    const rows = getDisplayPaymethods({ paymethods: [cashRow], plugins: [], excludeGateways: [], canInstall: false })
    expect(rows.some(row => row.installState === 'installable')).toBe(false)
    expect(rows.map(row => row.gateway)).toEqual([cashRow.gateway])
  })
})

describe('PaymethodRow', () => {
  // adapted (5.9): the enable box (`.paymethod-checkbox`) is a switch now
  it('shows a switch and no Install for a ready API paymethod', () => {
    renderRow()
    expect(screen.getByRole('switch', { name: 'Cash' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })

  // adapted (5.9): no switch on a catalog row
  it('shows Install and no switch for an installable catalog row', () => {
    renderRow({
      paymethod: paystackInstallable,
      displayName: 'Paystack'
    })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()
  })

  // adapted (5.9): the lead padding and the name inset were styled-components computed styles. The row has no padding of its own per kind
  // now: a catalog row keeps the room of the switch with a spacer as wide as a control, and the name sits in the same flex slot.
  it('keeps the room of the switch on a catalog row so the names line up', () => {
    renderRow({ paymethod: paystackInstallable, displayName: 'Paystack' })
    const lead = document.querySelector('.odc-pm-lead')
    expect(lead).toBeTruthy()
    expect(lead).toHaveAttribute('aria-hidden', 'true')
    expect(rule('.odc-pm-lead')).toMatch(/inline-size: var\(--od-x-control-height\)/)
    expect(rule('.odc-pm-lead')).toMatch(/flex: none/)
    // the name of a catalog row is the same flex slot as a name that opens nothing (tutorial)
    expect(screen.getByText('Paystack').closest('.odc-pm-label')).toBeTruthy()
    expect(rule('.odc-pm-label')).toMatch(/flex: 1 1 0/)
    expect(rule('.odc-paym-name')).toMatch(/flex: 1 1 0/)
  })

  it('does not open config when an installable row is clicked', () => {
    const props = renderRow({
      paymethod: paystackInstallable,
      displayName: 'Paystack'
    })
    fireEvent.click(screen.getByText('Paystack'))
    expect(props.onOpen).not.toHaveBeenCalled()
  })

  it('asks to install only after Confirm accept', () => {
    const handleInstallPaymentPlugin = vi.fn()

    const Harness = () => {
      const [confirm, setConfirm] = useState({ open: false, pluginKey: null, name: '' })
      return (
        <>
          <ul>
            <PaymethodRow
              paymethod={paystackInstallable}
              displayName='Paystack'
              isEnabled={false}
              installingPluginKey={null}
              onOpen={vi.fn()}
              onToggle={vi.fn()}
              onRequestInstall={(row) => setConfirm({ open: true, pluginKey: row.pluginKey, name: row.name })}
            />
          </ul>
          {confirm.open && (
            <div>
              <p>Install payment method</p>
              <button type='button' onClick={() => handleInstallPaymentPlugin(confirm.pluginKey)}>
                Accept
              </button>
            </div>
          )}
        </>
      )
    }

    renderWithProviders(<Harness />, { theme })
    expect(handleInstallPaymentPlugin).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(handleInstallPaymentPlugin).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handleInstallPaymentPlugin).toHaveBeenCalledWith('paystack')
  })

  // adapted (5.9): the styled-components computed style is the rule of the stylesheet now
  it('ellipsis long names so they do not collide with Install', () => {
    renderRow({
      paymethod: longNameRow,
      displayName: longNameRow.name
    })
    const name = screen.getByText(longNameRow.name)
    expect(name).toHaveAttribute('title', longNameRow.name)
    expect(name).toHaveClass('odc-pm-name-text')
    const style = rule('.odc-pm-name-text')
    expect(style).toMatch(/overflow: hidden/)
    expect(style).toMatch(/text-overflow: ellipsis/)
    expect(style).toMatch(/white-space: nowrap/)
    expect(style).toMatch(/min-inline-size: 0/)
  })

  it('Install says it is installing, and is not pressable meanwhile', () => {
    renderRow({ paymethod: paystackInstallable, displayName: 'Paystack', installingPluginKey: 'paystack' })
    expect(screen.getByRole('button', { name: 'Installing...' })).toBeDisabled()
  })

  it('shows Sandbox and Keys missing only on an enabled row', () => {
    renderRow({
      paymethod: { ...cashRow, id: 5, name: 'Paypal', gateway: 'paypal', data_template: null },
      displayName: 'Paypal',
      isEnabled: true,
      record: { id: 35, paymethod_id: 5, enabled: true, sandbox: true, data: null }
    })
    expect(screen.getByText('Sandbox')).toBeInTheDocument()
    expect(screen.getByText('Keys missing')).toBeInTheDocument()
  })

  it('the open row says so', () => {
    renderRow({ active: true })
    expect(document.querySelector('li')).toHaveAttribute('aria-current', 'true')
    expect(document.querySelector('li')).toHaveAttribute('data-section-split-key', '1')
  })
})

// redesign stores 1.B (G4-05): the switch that enables a gateway and the row that opens its settings were
// `div`s with `onClick`: unreachable with Tab and unnamed for assistive tech.
describe('PaymethodRow · keyboard (G4-05)', () => {
  // adapted (5.9): the named checkbox is a named switch; a press turns it the other way and opens nothing
  it('the enable switch is named, reached with Tab and toggled with Space', async () => {
    const user = userEvent.setup()
    const props = renderRow({ isEnabled: true })
    const toggle = screen.getByRole('switch', { name: 'Cash' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.tab()
    expect(toggle).toHaveFocus()
    await user.keyboard('[Space]')
    expect(props.onToggle).toHaveBeenCalledWith(cashRow, false)
    expect(props.onOpen).not.toHaveBeenCalled()
  })

  it('the name opens the settings with Enter', async () => {
    const user = userEvent.setup()
    const props = renderRow()
    const open = screen.getByRole('button', { name: /^Cash/ })
    await user.tab()
    await user.tab()
    expect(open).toHaveFocus()
    await user.keyboard('[Enter]')
    expect(props.onOpen).toHaveBeenCalledWith(cashRow)
    expect(props.onToggle).not.toHaveBeenCalled()
  })

  it('an off switch says so', () => {
    renderRow({ isEnabled: false })
    expect(screen.getByRole('switch', { name: 'Cash' })).toHaveAttribute('aria-checked', 'false')
  })

  it('a catalog row has no switch and its name is not a button', () => {
    renderRow({ paymethod: paystackInstallable, displayName: 'Paystack' })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Paystack/ })).not.toBeInTheDocument()
  })
})
