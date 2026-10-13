import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { getDisplayPaymethods } from '../getDisplayPaymethods'
import { PaymethodRow } from '../PaymethodRow'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

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

const renderRow = (overrides = {}) => {
  const props = {
    paymethod: cashRow,
    displayName: cashRow.name,
    isEnabled: false,
    showChevron: false,
    installingPluginKey: null,
    onOpenEdit: vi.fn(),
    onToggle: vi.fn(),
    onRequestInstall: vi.fn(),
    isTutorialMode: false,
    ...overrides
  }
  renderWithProviders(<PaymethodRow {...props} />, { theme })
  return props
}

describe('getDisplayPaymethods', () => {
  it('hides catalog Install rows in tutorial mode', () => {
    const rows = getDisplayPaymethods({
      paymethods: [cashRow],
      plugins: [],
      excludeGateways: [],
      isTutorialMode: true
    })
    expect(rows.every(row => row.source === 'api')).toBe(true)
    expect(rows.some(row => row.installState === 'installable')).toBe(false)
  })

  it('adds catalog Install rows in store details', () => {
    const rows = getDisplayPaymethods({
      paymethods: [cashRow],
      plugins: [],
      excludeGateways: [],
      isTutorialMode: false
    })
    expect(rows.some(row => row.pluginKey === 'paystack' && row.installState === 'installable')).toBe(true)
  })
})

describe('PaymethodRow', () => {
  it('shows a checkbox and no Install for a ready API paymethod', () => {
    renderRow()
    expect(document.querySelector('.paymethod-checkbox')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })

  it('shows Install and no checkbox for an installable catalog row', () => {
    renderRow({
      paymethod: paystackInstallable,
      displayName: 'Paystack'
    })
    expect(document.querySelector('.paymethod-checkbox')).toBeFalsy()
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()
  })

  it('keeps the same lead padding and name inset as checkbox rows', () => {
    renderRow()
    const readyLead = document.querySelector('.paymethod-checkbox')
    const readyName = screen.getByText('Cash')
    const readyLeadStyle = window.getComputedStyle(readyLead)
    const readyNameStyle = window.getComputedStyle(readyName)

    document.body.innerHTML = ''
    renderRow({
      paymethod: paystackInstallable,
      displayName: 'Paystack'
    })
    const catalogLead = document.querySelector('.paymethod-lead')
    const catalogName = screen.getByText('Paystack')
    const catalogLeadStyle = window.getComputedStyle(catalogLead)
    const catalogNameStyle = window.getComputedStyle(catalogName)

    expect(catalogLead).toBeTruthy()
    expect(catalogLeadStyle.paddingTop).toBe(readyLeadStyle.paddingTop)
    expect(catalogLeadStyle.paddingBottom).toBe(readyLeadStyle.paddingBottom)
    expect(catalogNameStyle.marginLeft).toBe(readyNameStyle.marginLeft)
    expect(catalogLead.querySelector('.paymethod-lead-spacer')).toBeTruthy()
  })

  it('does not open config when an installable row is clicked', () => {
    const props = renderRow({
      paymethod: paystackInstallable,
      displayName: 'Paystack'
    })
    fireEvent.click(screen.getByText('Paystack'))
    expect(props.onOpenEdit).not.toHaveBeenCalled()
  })

  it('asks to install only after Confirm accept', () => {
    const handleInstallPaymentPlugin = vi.fn()

    const Harness = () => {
      const [confirm, setConfirm] = useState({ open: false, pluginKey: null, name: '' })
      return (
        <>
          <PaymethodRow
            paymethod={paystackInstallable}
            displayName='Paystack'
            isEnabled={false}
            showChevron={false}
            installingPluginKey={null}
            onOpenEdit={vi.fn()}
            onToggle={vi.fn()}
            onRequestInstall={(row) => setConfirm({ open: true, pluginKey: row.pluginKey, name: row.name })}
            isTutorialMode={false}
          />
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

  it('ellipsis long names so they do not collide with Install', () => {
    renderRow({
      paymethod: longNameRow,
      displayName: longNameRow.name
    })
    const name = screen.getByText(longNameRow.name)
    expect(name).toHaveAttribute('title', longNameRow.name)
    const style = window.getComputedStyle(name)
    expect(style.overflow).toBe('hidden')
    expect(style.textOverflow).toBe('ellipsis')
    expect(style.whiteSpace).toBe('nowrap')
  })
})
