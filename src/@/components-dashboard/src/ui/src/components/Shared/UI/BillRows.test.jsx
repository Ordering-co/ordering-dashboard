import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { FeeBillRows } from './FeeBillRows'
import { TaxBillRows } from './TaxBillRows'

const lightTheme = createDashboardTheme(theme)
const t = (key, fallback) => fallback || key
const parsePrice = value => `$${value}`
const parseNumber = value => Number(value).toFixed(2)

const IconWrapper = styled.div.attrs({ 'data-testid': 'icon-wrapper' })`
  display: inline-flex;
  height: 20px;
`
const ExclamationWrapper = styled.div.attrs({ 'data-testid': 'exclamation-wrapper' })`
  display: inline-flex;
`

const renderRows = rows => render(
  <ThemeProvider theme={lightTheme}>
    <table><tbody>{rows}</tbody></table>
  </ThemeProvider>
)

describe('L2d-C13 FeeBillRows and TaxBillRows', () => {
  it('preserves fee filtering, amount/rate formatting and fallback names', () => {
    const fees = [
      { id: 1, name: 'Service fee', fixed: 2, percentage: 3, summary: { amount: 8 } },
      { id: 2, name: 'Hidden zero', fixed: 9, percentage: 4, summary: { amount: 0 } },
      { id: 3, summary: { fixed: 4, percentage_after_discount: 1 } },
      { id: 4, name: 'NaN fee', summary: {} }
    ]

    renderRows(<FeeBillRows fees={fees} parsePrice={parsePrice} t={t} />)

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAttribute('data-slot', 'bill-row')
    expect(rows[0]).toHaveAttribute('data-row-kind', 'fee')
    expect(rows[0]).toHaveTextContent('Service fee($2 + 3%)')
    expect(rows[0].querySelector('[data-bill-row-slot="amount"]')).toHaveTextContent('$8')
    expect(rows[1]).toHaveTextContent('Inherit from business')
    expect(rows[1].querySelector('[data-bill-row-slot="amount"]')).toHaveTextContent('$5')
    expect(rows[2]).toHaveTextContent('NaN fee')
    expect(rows[2].querySelector('[data-bill-row-slot="amount"]')).toHaveTextContent('$NaN')
    expect(screen.queryByText('Hidden zero')).not.toBeInTheDocument()
  })

  it('preserves tax target/type filtering, discounted amount and decimal formatting', () => {
    const taxes = [
      { id: 1, name: 'City tax', target: 'product', type: 2, rate: 7.125, summary: { tax: 9, tax_after_discount: 6 } },
      { id: 2, name: 'Whole tax', target: 'product', type: 2, rate: 5, summary: { tax: 2 } },
      { id: 3, name: 'Included tax', target: 'product', type: 1, rate: 4, summary: { tax: 3 } },
      { id: 4, name: 'Order tax', target: 'order', type: 2, rate: 2, summary: { tax: 3 } },
      { id: 5, name: 'Zero tax', target: 'product', type: 2, rate: 2, summary: { tax: 0 } }
    ]
    const parseNumberSpy = vi.fn(parseNumber)

    renderRows(
      <TaxBillRows
        taxes={taxes}
        target='product'
        parsePrice={parsePrice}
        parseNumber={parseNumberSpy}
        t={t}
      />
    )

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute('data-row-kind', 'tax')
    expect(rows[0]).toHaveTextContent('City tax(7.13%)')
    expect(rows[0].querySelector('[data-bill-row-slot="amount"]')).toHaveTextContent('$6')
    expect(rows[1]).toHaveTextContent('Whole tax(5%)')
    expect(parseNumberSpy).toHaveBeenCalledOnce()
    expect(parseNumberSpy).toHaveBeenCalledWith(7.125)
    expect(screen.queryByText('Included tax')).not.toBeInTheDocument()
    expect(screen.queryByText('Order tax')).not.toBeInTheDocument()
    expect(screen.queryByText('Zero tax')).not.toBeInTheDocument()
  })

  it('opens the exact original fee object from a named native action', async () => {
    const user = userEvent.setup()
    const setOpenTaxModal = vi.fn()
    const fee = { id: 7, name: 'Delivery service', summary: { amount: 4 } }

    renderRows(
      <FeeBillRows
        fees={[fee]}
        setOpenTaxModal={setOpenTaxModal}
        parsePrice={parsePrice}
        t={t}
        IconWrapper={IconWrapper}
      />
    )

    const action = screen.getByRole('button', { name: 'Info: Delivery service' })
    expect(action).toHaveAttribute('type', 'button')
    expect(action).toHaveAttribute('data-bill-row-slot', 'info-action')
    expect(action.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    const wrapper = screen.getByTestId('icon-wrapper')
    expect(wrapper.tagName).toBe('SPAN')
    expect(wrapper).toHaveAttribute('data-bill-row-slot', 'action-wrapper')
    expect(wrapper).toHaveAttribute('data-icon-variant', 'icon')
    expect(wrapper.querySelector('button button')).not.toBeInTheDocument()

    await user.tab()
    expect(action).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(setOpenTaxModal).toHaveBeenCalledOnce()
    expect(setOpenTaxModal).toHaveBeenCalledWith({ open: true, data: fee, type: 'fee' })
  })

  it('uses only the matching exclamation wrapper and exact tax payload', async () => {
    const user = userEvent.setup()
    const setOpenTaxModal = vi.fn()
    const tax = { id: 8, name: 'Local tax', target: 'order', type: 2, summary: { tax: 3 } }

    renderRows(
      <TaxBillRows
        taxes={[tax]}
        target='order'
        setOpenTaxModal={setOpenTaxModal}
        parsePrice={parsePrice}
        parseNumber={parseNumber}
        t={t}
        iconVariant='exclamation'
        IconWrapper={IconWrapper}
        ExclamationWrapper={ExclamationWrapper}
      />
    )

    expect(screen.queryByTestId('icon-wrapper')).not.toBeInTheDocument()
    expect(screen.getByTestId('exclamation-wrapper')).toHaveAttribute('data-icon-variant', 'exclamation')
    const action = screen.getByRole('button', { name: 'Info: Local tax' })
    await user.click(action)
    expect(setOpenTaxModal).toHaveBeenCalledWith({ open: true, data: tax, type: 'tax' })
  })

  it('keeps the callback and corresponding caller wrapper gates', () => {
    const fee = { id: 1, name: 'Fee', summary: { amount: 1 } }
    const tax = { id: 2, name: 'Tax', target: 'product', type: 2, summary: { tax: 1 } }
    const setOpenTaxModal = vi.fn()

    renderRows(
      <>
        <FeeBillRows fees={[fee]} parsePrice={parsePrice} t={t} IconWrapper={IconWrapper} />
        <TaxBillRows
          taxes={[tax]}
          target='product'
          setOpenTaxModal={setOpenTaxModal}
          parsePrice={parsePrice}
          parseNumber={parseNumber}
          t={t}
          iconVariant='exclamation'
          IconWrapper={IconWrapper}
        />
      </>
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('returns no rows for absent or fully hidden collections', () => {
    renderRows(
      <>
        <FeeBillRows parsePrice={parsePrice} t={t} />
        <TaxBillRows taxes={[]} target='product' parsePrice={parsePrice} parseNumber={parseNumber} t={t} />
      </>
    )
    expect(screen.queryByRole('row')).not.toBeInTheDocument()
  })
})
